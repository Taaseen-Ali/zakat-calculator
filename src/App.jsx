import { useState, useCallback, useEffect, useRef } from 'react'
import { calculateZakat } from './utils/zakatCalculations'
import { STATE_TAX_RATES, STATES } from './utils/stateTaxRates'
import { cardsToForm } from './utils/cardsToForm'
import { fetchMetalPrices } from './utils/metalPrices'
import { exportZakatReport } from './utils/exportPdf'
import { fetchCryptoPrices } from './utils/cryptoApi'
import { TickerAutocomplete } from './components/TickerAutocomplete'
import { CryptoAutocomplete } from './components/CryptoAutocomplete'
import { ASSET_TYPES, LIABILITY_TYPES, ASSET_GROUPS, LIABILITY_GROUPS, defaultAssetData, defaultLiabilityData } from './assetTypes'
import './App.css'

const ZAKAT_RATE_PCT = 2.5

function getDefaultEntryLabel(entry, type, index, types) {
  const typeLabel = types.find((t) => t.id === type)?.label || type
  const isStock = type === 'stocks_short' || type === 'stocks_long'
  if (isStock && entry.ticker?.trim()) return entry.ticker.trim().toUpperCase()
  return `${typeLabel} ${index + 1}`
}

function migrateToEntriesFormat(cards, isAsset, types) {
  if (!Array.isArray(cards)) return []
  return cards.map((card) => {
    if (card.entries && Array.isArray(card.entries)) {
      return {
        ...card,
        entries: (card.entries || []).map((e, i) => ({
          ...e,
          entryLabel: e.entryLabel ?? getDefaultEntryLabel(e, card.type, i, types)
        }))
      }
    }
    const { id, type, ...rest } = card
    const typeLabel = types.find((t) => t.id === type)?.label || type
    return { id, type, entries: [{ id: id + '-e0', entryLabel: `${typeLabel} 1`, ...rest }] }
  })
}

function useLocalState(key, initial, migrate) {
  const [value, setValue] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      const parsed = s != null ? JSON.parse(s) : initial
      return migrate ? migrate(parsed) : parsed
    } catch {
      return initial
    }
  })
  const set = useCallback((v) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? v(prev) : v
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch (_) {}
      return next
    })
  }, [key])
  return [value, set]
}

function uid() {
  return Math.random().toString(36).slice(2, 11)
}

function formatMoney(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getEntryValue(entry, type, goldPrice, silverPrice) {
  switch (type) {
    case 'cash': return Number(entry.amount) || 0
    case 'gold_silver': {
      const g = (Number(entry.goldGrams) || 0) * (goldPrice || 0)
      const s = (Number(entry.silverGrams) || 0) * (silverPrice || 0)
      return g + s
    }
    case 'crypto': {
      const amount = Number(entry.amount) || 0
      const price = Number(entry.price) || 0
      return amount && price ? amount * price : (Number(entry.value) || 0)
    }
    case 'stocks_short': {
      const mode = entry.stocksInputMode || 'per_share'
      if (mode === 'total') return Number(entry.value) || 0
      const shares = Number(entry.shares) || 0
      const price = Number(entry.pricePerShare) || 0
      return shares && price ? shares * price : 0
    }
    case 'stocks_long': {
      const mode = entry.stocksInputMode || 'per_share'
      if (mode === 'total') return Number(entry.value) || 0
      return (Number(entry.shares) || 0) * (Number(entry.pricePerShare) || 0)
    }
    case 'retirement': {
      if (entry.method === 'method2' && (entry.funds || []).length > 0) {
        return (entry.funds || []).reduce((s, f) => s + (Number(f.balance) || 0), 0)
      }
      return Number(entry.balance) || 0
    }
    case 'real_estate': return Number(entry.marketValue) || 0
    case 'rental': return Number(entry.balance) || 0
    case 'business': {
      return (Number(entry.cash) || 0) + (Number(entry.inventory) || 0) + (Number(entry.receivables) || 0) - (Number(entry.liabilities) || 0)
    }
    case 'money_lent': return Number(entry.amount) || 0
    default: return 0
  }
}

function getAssetSummary(card, goldPrice, silverPrice) {
  const entries = card.entries || []
  if (entries.length === 0) return ''
  const total = entries.reduce((s, e) => s + getEntryValue(e, card.type, goldPrice, silverPrice), 0)
  if (total === 0) return ''
  return formatMoney(total)
}

function getLiabilitySummary(card) {
  const entries = card.entries || []
  const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  return total > 0 ? formatMoney(total) : ''
}

function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!visible) return
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setVisible(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible])
  if (!text) return null
  return (
    <span className="info-tooltip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={() => setVisible((v) => !v)}
        aria-label="How this contributes to zakat"
      >
        i
      </button>
      {visible && (
        <div className="info-tooltip-popover" role="tooltip">
          {text}
        </div>
      )}
    </span>
  )
}

export default function App() {
  const [nisabStandard, setNisabStandard] = useLocalState('fikr-nisab', 'gold')
  const [assetCards, setAssetCards] = useLocalState('fikr-assetCards', [], (v) => migrateToEntriesFormat(v, true, ASSET_TYPES))
  const [liabilityCards, setLiabilityCards] = useLocalState('fikr-liabilityCards', [], (v) => migrateToEntriesFormat(v, false, LIABILITY_TYPES))
  const [pricesLoading, setPricesLoading] = useState(true)
  const [liveGold, setLiveGold] = useState(null)
  const [liveSilver, setLiveSilver] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { gold, silver } = await fetchMetalPrices()
      if (cancelled) return
      setLiveGold(gold)
      setLiveSilver(silver)
      setPricesLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function refreshMetalPrices() {
    setPricesLoading(true)
    const { gold, silver } = await fetchMetalPrices()
    setLiveGold(gold)
    setLiveSilver(silver)
    setPricesLoading(false)
  }

  const goldPrice = liveGold ?? 75
  const silverPrice = liveSilver ?? 1.05

  const form = cardsToForm(assetCards, liabilityCards, nisabStandard, goldPrice, silverPrice)
  form.stateTaxRate = STATE_TAX_RATES[form.stateName] ?? 0
  const result = calculateZakat(form)

  const addAsset = (type, selectTab) => {
    setAssetCards((prev) => {
      const migrated = migrateToEntriesFormat(prev, true, ASSET_TYPES)
      const existing = migrated.find((c) => c.type === type)
      const entryData = defaultAssetData(type)
      if (type === 'gold_silver') {
        entryData.goldPrice = goldPrice
        entryData.silverPrice = silverPrice
      }
      const typeLabel = ASSET_TYPES.find((t) => t.id === type)?.label || type
      const entryIndex = existing ? (existing.entries?.length || 0) + 1 : 1
      const newEntry = { id: uid(), ...entryData, entryLabel: `${typeLabel} ${entryIndex}` }
      let idToSelect
      if (existing) {
        idToSelect = existing.id
        expandCard(existing.id)
        const next = migrated.map((c) =>
          c.type === type ? { ...c, entries: [...(c.entries || []), newEntry] } : c
        )
        if (selectTab) setTimeout(() => setActiveAssetTab(idToSelect), 0)
        return next
      }
      const cardId = uid()
      idToSelect = cardId
      expandCard(cardId)
      if (selectTab) setTimeout(() => setActiveAssetTab(idToSelect), 0)
      return [...migrated, { id: cardId, type, entries: [newEntry] }]
    })
  }

  const addLiability = (type, selectTab) => {
    setLiabilityCards((prev) => {
      const migrated = migrateToEntriesFormat(prev, false, LIABILITY_TYPES)
      const existing = migrated.find((c) => c.type === type)
      const typeLabel = LIABILITY_TYPES.find((t) => t.id === type)?.label || type
      const entryIndex = existing ? (existing.entries?.length || 0) + 1 : 1
      const newEntry = { id: uid(), ...defaultLiabilityData(type), entryLabel: `${typeLabel} ${entryIndex}` }
      let idToSelect
      if (existing) {
        idToSelect = existing.id
        expandCard(existing.id)
        const next = migrated.map((c) =>
          c.type === type ? { ...c, entries: [...(c.entries || []), newEntry] } : c
        )
        if (selectTab) setTimeout(() => setActiveLiabilityTab(idToSelect), 0)
        return next
      }
      const cardId = uid()
      idToSelect = cardId
      expandCard(cardId)
      if (selectTab) setTimeout(() => setActiveLiabilityTab(idToSelect), 0)
      return [...migrated, { id: cardId, type, entries: [newEntry] }]
    })
  }

  const updateAssetEntry = (cardId, entryId, data) => {
    setAssetCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, entries: (c.entries || []).map((e) => (e.id === entryId ? { ...e, ...data } : e)) }
          : c
      )
    )
  }

  const updateLiabilityEntry = (cardId, entryId, data) => {
    setLiabilityCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, entries: (c.entries || []).map((e) => (e.id === entryId ? { ...e, ...data } : e)) }
          : c
      )
    )
  }

  const removeAssetEntry = (cardId, entryId) => {
    setAssetCards((prev) => {
      const next = prev.map((c) => {
        if (c.id !== cardId) return c
        const entries = (c.entries || []).filter((e) => e.id !== entryId)
        return entries.length ? { ...c, entries } : null
      }).filter(Boolean)
      return next
    })
  }

  const removeLiabilityEntry = (cardId, entryId) => {
    setLiabilityCards((prev) => {
      const next = prev.map((c) => {
        if (c.id !== cardId) return c
        const entries = (c.entries || []).filter((e) => e.id !== entryId)
        return entries.length ? { ...c, entries } : null
      }).filter(Boolean)
      return next
    })
  }

  const removeAssetCard = (cardId) => setAssetCards((prev) => prev.filter((c) => c.id !== cardId))
  const removeLiabilityCard = (cardId) => setLiabilityCards((prev) => prev.filter((c) => c.id !== cardId))

  const [expandedCards, setExpandedCards] = useState(() => {
    const assets = (() => { try { return migrateToEntriesFormat(JSON.parse(localStorage.getItem('fikr-assetCards') || '[]'), true, ASSET_TYPES) } catch { return [] } })()
    const liabilities = (() => { try { return migrateToEntriesFormat(JSON.parse(localStorage.getItem('fikr-liabilityCards') || '[]'), false, LIABILITY_TYPES) } catch { return [] } })()
    const ids = [...assets.map((c) => c.id), ...liabilities.map((c) => c.id)]
    return new Set(ids)
  })
  const [activeAssetTab, setActiveAssetTab] = useLocalState('fikr-activeAssetTab', null)
  const [activeLiabilityTab, setActiveLiabilityTab] = useLocalState('fikr-activeLiabilityTab', null)

  useEffect(() => {
    if (assetCards.length === 0) setActiveAssetTab(null)
    else if (!assetCards.some((c) => c.id === activeAssetTab)) setActiveAssetTab(assetCards[0].id)
  }, [assetCards, activeAssetTab])
  useEffect(() => {
    if (liabilityCards.length === 0) setActiveLiabilityTab(null)
    else if (!liabilityCards.some((c) => c.id === activeLiabilityTab)) setActiveLiabilityTab(liabilityCards[0].id)
  }, [liabilityCards, activeLiabilityTab])
  const [showCalculation, setShowCalculation] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const resultRef = useRef(null)

  useEffect(() => {
    const el = resultRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const { isIntersecting, boundingClientRect } = entry
        if (isIntersecting) {
          setShowStickyBar(false)
        } else if (boundingClientRect.top < 0) {
          setShowStickyBar(true)
        } else {
          setShowStickyBar(false)
        }
      },
      { threshold: 0, rootMargin: '0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const toggleCard = (id) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const expandCard = (id) => setExpandedCards((prev) => new Set(prev).add(id))


  return (
    <div className="dashboard">
      <div className={`zakat-sticky-bar ${showStickyBar ? '' : 'hidden'}`} aria-hidden={!showStickyBar}>
        <div className="zakat-sticky-bar-content">
          <span className="zakat-sticky-bar-label">Zakat due</span>
          <span className="zakat-sticky-bar-amount">${result.zakatDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="dashboard-logo">FIKR</span>
          <h1 className="dashboard-title">Zakat Dashboard</h1>
        </div>
        <div className="dashboard-meta">
          <div className="prices-pill">
            <span>{pricesLoading ? '…' : `Gold $${goldPrice}/g`}</span>
            <span>{pricesLoading ? '…' : `Silver $${silverPrice}/g`}</span>
            <button type="button" onClick={refreshMetalPrices} disabled={pricesLoading}>↻</button>
          </div>
        </div>
      </header>

      <div className="dashboard-result" ref={resultRef}>
        <div className="result-top">
          <div className="result-main">
            <span className="result-label">Zakat due</span>
            <span className="result-amount">${result.zakatDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="nisab-selector">
            <div className="nisab-selector-header">
              <span className="nisab-selector-label">Nisab threshold</span>
              <InfoTooltip text="The minimum wealth you must have for zakat to be obligatory. If your net wealth is below this amount, no zakat is due. Gold (85g) is recommended by most scholars; silver (595g) yields a lower threshold." />
            </div>
            <p className="nisab-selector-desc">Minimum wealth for zakat to be due</p>
            <div className="nisab-pill">
              <button type="button" className={nisabStandard === 'gold' ? 'active' : ''} onClick={() => setNisabStandard('gold')}>Gold — 85g</button>
              <button type="button" className={nisabStandard === 'silver' ? 'active' : ''} onClick={() => setNisabStandard('silver')}>Silver — 595g</button>
            </div>
          </div>
        </div>
        <div className="result-details">
          <span>Assets ${result.totalZakatableAssets.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
          <span>− Liabilities ${result.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
          <span>Nisab ${result.nisab.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
        </div>
        <button type="button" className="btn-pdf" onClick={() => exportZakatReport(result)}>Download PDF</button>
        <div className="result-calculation">
          <button
            type="button"
            className="result-calculation-toggle"
            onClick={() => setShowCalculation((v) => !v)}
            aria-expanded={showCalculation}
          >
            <span>{showCalculation ? 'Hide' : 'Show'} calculation</span>
            <svg className={`result-calculation-chevron ${showCalculation ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showCalculation && (
            <div className="result-calculation-body">
              <div className="calc-section">
                <div className="calc-section-title">Assets</div>
                {(result.assetBreakdownDetailed || []).map((section) => (
                  <div key={section.type || section.label} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value">${section.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-entry-detail">
                        <div className="calc-step calc-step-entry">
                          <span className="calc-step-label">{entry.label}</span>
                          <span className="calc-step-value">${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {entry.steps?.map((step, j) => (
                          <div key={j} className="calc-step calc-step-mini">
                            <span className="calc-step-label">{step.desc}</span>
                            <span className="calc-step-value">{step.value >= 0 ? '$' : '−$'}{Math.abs(step.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">Total zakatable assets</span>
                  <span className="calc-step-value">${result.totalZakatableAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-section-title">Liabilities</div>
                {(result.liabilityBreakdownDetailed || []).map((section, idx) => (
                  <div key={idx} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value">−${section.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-step calc-step-entry">
                        <span className="calc-step-label">{entry.label}</span>
                        <span className="calc-step-value">−${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">Total liabilities</span>
                  <span className="calc-step-value">−${result.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="calc-step calc-step-equals">
                <span className="calc-step-label">Net zakatable wealth</span>
                <span className="calc-step-value">${result.netZakatableWealth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="calc-step">
                <span className="calc-step-label">Nisab threshold</span>
                <span className="calc-step-value">${result.nisab.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {result.meetsNisab ? (
                <div className="calc-step calc-step-result">
                  <span className="calc-step-label">Zakat due (2.5% of net wealth)</span>
                  <span className="calc-step-value">${result.zakatDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="calc-step calc-step-result">
                  <span className="calc-step-label">Net wealth below nisab — no zakat due</span>
                  <span className="calc-step-value">$0.00</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`dashboard-grid ${assetCards.length === 0 && liabilityCards.length === 0 ? 'dashboard-grid-empty' : ''}`}>
        <div className="dashboard-column">
          <div className="column-header">
            <h2 className="column-title">Assets</h2>
            <select
              className="add-dropdown"
              value=""
              onChange={(e) => { const v = e.target.value; if (v) { addAsset(v, true); e.target.value = '' } }}
              title="Add asset type"
            >
              <option value="">+ Add asset…</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.id} value={t.id} title={t.tooltip}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          {assetCards.length > 0 ? (
            <div className="tab-panel">
              <div className="tabs-wrap">
                <div className="tabs-scroll">
                  {assetCards.map((card) => {
                    const t = ASSET_TYPES.find((x) => x.id === card.type)
                    const summary = getAssetSummary(card, goldPrice, silverPrice)
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`tab-btn ${activeAssetTab === card.id ? 'active' : ''}`}
                        onClick={() => setActiveAssetTab(card.id)}
                      >
                        <span className="tab-icon">{t?.icon}</span>
                        <span className="tab-label">{t?.label}</span>
                        {summary && <span className="tab-summary">{summary}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="tab-content">
                {activeAssetTab && assetCards.find((c) => c.id === activeAssetTab) ? (
                  (() => {
                    const card = assetCards.find((c) => c.id === activeAssetTab)
                    return card ? (
                      <AssetCard
                        key={card.id}
                        card={card}
                        goldPrice={goldPrice}
                        silverPrice={silverPrice}
                        expanded={true}
                        inTab
                        onToggle={() => {}}
                        onUpdateEntry={(entryId, d) => updateAssetEntry(card.id, entryId, d)}
                        onRemoveEntry={(e, entryId) => { e.stopPropagation(); removeAssetEntry(card.id, entryId) }}
                        onRemoveCard={(e) => { e.stopPropagation(); removeAssetCard(card.id) }}
                        onAddEntry={() => addAsset(card.type, false)}
                        states={STATES}
                      />
                    ) : null
                  })()
                ) : (
                  <p className="tab-empty">Select a tab above</p>
                )}
              </div>
            </div>
          ) : (
            <p className="column-empty">Add an asset type to get started</p>
          )}
        </div>

        <div className="dashboard-column">
          <div className="column-header">
            <h2 className="column-title">Liabilities</h2>
            <select
              className="add-dropdown"
              value=""
              onChange={(e) => { const v = e.target.value; if (v) { addLiability(v, true); e.target.value = '' } }}
              title="Add liability type"
            >
              <option value="">+ Add liability…</option>
              {LIABILITY_TYPES.map((t) => (
                <option key={t.id} value={t.id} title={t.tooltip}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          {liabilityCards.length > 0 ? (
            <div className="tab-panel">
              <div className="tabs-wrap">
                <div className="tabs-scroll">
                  {liabilityCards.map((card) => {
                    const t = LIABILITY_TYPES.find((x) => x.id === card.type)
                    const summary = getLiabilitySummary(card)
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`tab-btn ${activeLiabilityTab === card.id ? 'active' : ''}`}
                        onClick={() => setActiveLiabilityTab(card.id)}
                      >
                        <span className="tab-icon">{t?.icon}</span>
                        <span className="tab-label">{t?.label}</span>
                        {summary && <span className="tab-summary">{summary}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="tab-content">
                {activeLiabilityTab && liabilityCards.find((c) => c.id === activeLiabilityTab) ? (
                  (() => {
                    const card = liabilityCards.find((c) => c.id === activeLiabilityTab)
                    return card ? (
                      <LiabilityCard
                        key={card.id}
                        card={card}
                        expanded={true}
                        inTab
                        onToggle={() => {}}
                        onUpdateEntry={(entryId, d) => updateLiabilityEntry(card.id, entryId, d)}
                        onRemoveEntry={(e, entryId) => { e.stopPropagation(); removeLiabilityEntry(card.id, entryId) }}
                        onRemoveCard={(e) => { e.stopPropagation(); removeLiabilityCard(card.id) }}
                        onAddEntry={() => addLiability(card.type, false)}
                      />
                    ) : null
                  })()
                ) : (
                  <p className="tab-empty">Select a tab above</p>
                )}
              </div>
            </div>
          ) : (
            <p className="column-empty">Add a liability type to get started</p>
          )}
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>Zakat guide by Foundation for Inquiry, Knowledge and Revival</p>
      </footer>
    </div>
  )
}

function AssetCard({ card, goldPrice, silverPrice, expanded, inTab, onToggle, onUpdateEntry, onRemoveEntry, onRemoveCard, onAddEntry, states }) {
  const t = ASSET_TYPES.find((x) => x.id === card.type)
  const summary = getAssetSummary(card, goldPrice, silverPrice)
  const entries = card.entries || []
  const showBody = inTab || expanded
  return (
    <div className={`card ${showBody ? 'card-expanded' : ''} ${inTab ? 'card-in-tab' : ''}`}>
      {!inTab && (
      <div className="card-header" onClick={onToggle} onKeyDown={(e) => e.key === 'Enter' && onToggle()} role="button" tabIndex={0}>
        <span className="card-type">{t?.icon} {t?.label}</span>
        <span className="card-summary">{summary}</span>
        <span className="card-header-actions" onClick={(e) => e.stopPropagation()}>
          <InfoTooltip text={t?.tooltip} />
          <button type="button" className="card-remove" onClick={onRemoveCard} aria-label="Remove card">×</button>
        </span>
        <span className="card-chevron" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </span>
      </div>
      )}
      {showBody && (
      <div className="card-body">
        {entries.map((entry, index) => (
          <EntryDrawer
            key={entry.id}
            entry={entry}
            card={card}
            index={index}
            types={ASSET_TYPES}
            onUpdateEntry={onUpdateEntry}
            onRemoveEntry={onRemoveEntry}
            summary={(v => v > 0 ? formatMoney(v) : '')(getEntryValue(entry, card.type, goldPrice, silverPrice))}
          >
            <AssetEntryContent
              entry={entry}
              card={card}
              goldPrice={goldPrice}
              silverPrice={silverPrice}
              states={states}
              onUpdateEntry={onUpdateEntry}
            />
          </EntryDrawer>
        ))}
        <button type="button" className="add-more" onClick={onAddEntry}>+ Add another {t?.label?.toLowerCase()}</button>
      </div>
      )}
    </div>
  )
}

function EntryDrawer({ entry, card, index, types, onUpdateEntry, onRemoveEntry, summary, children }) {
  const [expanded, setExpanded] = useState(true)
  const label = entry.entryLabel ?? getDefaultEntryLabel(entry, card.type, index, types)
  return (
    <div className={`card-entry drawer ${expanded ? 'drawer-expanded' : 'drawer-collapsed'}`}>
      <div
        className="card-entry-header"
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
      >
        <span className="card-entry-chevron" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </span>
        <div className="card-entry-header-left">
          <input
            type="text"
            className="card-entry-label"
            value={label}
            onChange={(e) => onUpdateEntry(entry.id, { entryLabel: e.target.value })}
            placeholder={getDefaultEntryLabel(entry, card.type, index, types)}
            onClick={(e) => e.stopPropagation()}
          />
          {summary != null && summary !== '' && (
            <span className="card-entry-summary">{summary}</span>
          )}
        </div>
        <span className="card-entry-actions">
          <button type="button" className="card-remove" onClick={(e) => { e.stopPropagation(); onRemoveEntry(e, entry.id) }} aria-label="Remove entry">×</button>
        </span>
      </div>
      {expanded && <div className="card-entry-body">{children}</div>}
    </div>
  )
}

function AssetEntryContent({ entry, card, goldPrice, silverPrice, states, onUpdateEntry }) {
  return (
    <>
      {card.type === 'cash' && (
        <InputRow label="Amount" prefix="$" value={entry.amount} onChange={(v) => onUpdateEntry(entry.id, { amount: v })} />
      )}
      {card.type === 'gold_silver' && (
        <>
          <InputRow label="Gold (g)" value={entry.goldGrams} onChange={(v) => onUpdateEntry(entry.id, { goldGrams: v })} />
          <InputRow label="Silver (g)" value={entry.silverGrams} onChange={(v) => onUpdateEntry(entry.id, { silverGrams: v })} />
          <p className="card-hint">Prices: ${goldPrice}/g gold, ${silverPrice}/g silver</p>
        </>
      )}
      {card.type === 'crypto' && (
        <CryptoCardFields card={entry} onUpdate={(d) => onUpdateEntry(entry.id, d)} />
      )}
      {card.type === 'stocks_short' && (
        <StocksShortCardFields card={entry} onUpdate={(d) => onUpdateEntry(entry.id, d)} />
      )}
      {card.type === 'stocks_long' && (
        <StocksLongCardFields card={entry} onUpdate={(d) => onUpdateEntry(entry.id, d)} />
      )}
      {card.type === 'retirement' && (
        <RetirementCardFields card={entry} onUpdate={(d) => onUpdateEntry(entry.id, d)} states={states} />
      )}
      {card.type === 'real_estate' && (
        <>
          <InputRow label="Property" type="text" value={entry.name} onChange={(v) => onUpdateEntry(entry.id, { name: v })} />
          <InputRow label="Market value" prefix="$" value={entry.marketValue} onChange={(v) => onUpdateEntry(entry.id, { marketValue: v })} />
        </>
      )}
      {card.type === 'rental' && (
        <>
          <InputRow label="Property" type="text" value={entry.name} onChange={(v) => onUpdateEntry(entry.id, { name: v })} />
          <InputRow label="Account balance" prefix="$" value={entry.balance} onChange={(v) => onUpdateEntry(entry.id, { balance: v })} />
        </>
      )}
      {card.type === 'business' && (
        <>
          <label className="card-check">
            <input type="checkbox" checked={entry.soleOwner} onChange={(e) => onUpdateEntry(entry.id, { soleOwner: e.target.checked })} />
            Sole owner
          </label>
          {!entry.soleOwner && <InputRow label="Ownership %" value={entry.ownershipPct} onChange={(v) => onUpdateEntry(entry.id, { ownershipPct: v })} />}
          <InputRow label="Cash" prefix="$" value={entry.cash} onChange={(v) => onUpdateEntry(entry.id, { cash: v })} />
          <InputRow label="Inventory" prefix="$" value={entry.inventory} onChange={(v) => onUpdateEntry(entry.id, { inventory: v })} />
          <InputRow label="Receivables" prefix="$" value={entry.receivables} onChange={(v) => onUpdateEntry(entry.id, { receivables: v })} />
          <InputRow label="− Liabilities" prefix="$" value={entry.liabilities} onChange={(v) => onUpdateEntry(entry.id, { liabilities: v })} />
        </>
      )}
      {card.type === 'money_lent' && (
        <>
          <InputRow label="Description" type="text" value={entry.description} onChange={(v) => onUpdateEntry(entry.id, { description: v })} />
          <InputRow label="Amount" prefix="$" value={entry.amount} onChange={(v) => onUpdateEntry(entry.id, { amount: v })} />
          <label className="card-check">
            <input type="checkbox" checked={entry.strong !== false} onChange={(e) => onUpdateEntry(entry.id, { strong: e.target.checked })} />
            Strong debt (zakatable)
          </label>
        </>
      )}
    </>
  )
}

function CryptoCardFields({ card, onUpdate }) {
  const [refreshing, setRefreshing] = useState(false)
  const isTrading = card.isTrading !== false

  async function handleRefresh() {
    if (!card.coinId) return
    setRefreshing(true)
    const prices = await fetchCryptoPrices([card.coinId])
    setRefreshing(false)
    if (prices[card.coinId] != null) onUpdate({ price: String(prices[card.coinId]) })
  }

  return (
    <>
      <div className="card-field">
        <label>Holding type</label>
        <div className="card-pill">
          <button type="button" className={isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: true })}>
            Trading
          </button>
          <button type="button" className={!isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: false })}>
            Long-term
          </button>
        </div>
        <p className="card-hint">Only trading (bought to sell) is zakatable. Long-term holdings are excluded.</p>
      </div>
      <div className="card-field">
        <label>Coin</label>
        <CryptoAutocomplete
          value={card.name}
          onChange={(v) => onUpdate({ name: v })}
          onCoinSelect={(c) => onUpdate({ coinId: c.id, name: c.name, price: c.price != null ? String(c.price) : '' })}
        />
      </div>
      <div className="card-row">
        <InputRow label="Amount held" value={card.amount} onChange={(v) => onUpdate({ amount: v })} placeholder="e.g. 0.5" />
        <div className="card-field">
          <label>Price per coin ($)</label>
          <div className="input-with-refresh">
            <div className="input-wrap">
              <span className="prefix">$</span>
              <input type="number" className="input has-prefix" value={card.price ?? ''} onChange={(e) => onUpdate({ price: e.target.value })} placeholder="Auto-filled" min="0" step="0.01" />
            </div>
            <button type="button" className="btn-refresh" onClick={handleRefresh} disabled={!card.coinId || refreshing} title="Refresh price">
              {refreshing ? '…' : '↻'}
            </button>
          </div>
        </div>
      </div>
      <div className="card-field">
        <label>Or enter total value ($)</label>
        <div className="input-wrap">
          <span className="prefix">$</span>
          <input type="number" className="input has-prefix" value={card.value ?? ''} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="If not using amount × price" min="0" step="0.01" />
        </div>
      </div>
      <p className="card-hint">Value = amount × price, or enter total value directly.</p>
    </>
  )
}

function StocksShortCardFields({ card, onUpdate }) {
  const mode = card.stocksInputMode || 'per_share'
  return (
    <>
      <div className="card-field">
        <label>Ticker (optional)</label>
        <TickerAutocomplete value={card.ticker} onChange={(v) => onUpdate({ ticker: v, ...(v?.trim() && { entryLabel: v.trim().toUpperCase() }) })} />
      </div>
      <div className="card-field">
        <label>Input method</label>
        <div className="card-pill">
          <button type="button" className={mode === 'per_share' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'per_share' })}>
            Per share
          </button>
          <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'total' })}>
            Total value
          </button>
        </div>
      </div>
      {mode === 'per_share' ? (
        <div className="card-row">
          <InputRow label="Shares" value={card.shares} onChange={(v) => onUpdate({ shares: v })} placeholder="e.g. 100" />
          <InputRow label="Price/share ($)" prefix="$" value={card.pricePerShare} onChange={(v) => onUpdate({ pricePerShare: v })} placeholder="e.g. 150.00" />
        </div>
      ) : (
        <InputRow label="Total market value ($)" prefix="$" value={card.value} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. 15000.00" />
      )}
    </>
  )
}

function StocksLongCardFields({ card, onUpdate }) {
  const mode = card.stocksInputMode || 'per_share'
  return (
    <>
      <div className="card-field">
        <label>Ticker</label>
        <TickerAutocomplete value={card.ticker} onChange={(v) => onUpdate({ ticker: v, ...(v?.trim() && { entryLabel: v.trim().toUpperCase() }) })} />
      </div>
      <div className="card-field">
        <label>Input method</label>
        <div className="card-pill">
          <button type="button" className={mode === 'per_share' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'per_share' })}>
            Per share
          </button>
          <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'total' })}>
            Total value
          </button>
        </div>
      </div>
      {mode === 'per_share' ? (
        <div className="card-row">
          <InputRow label="Shares" value={card.shares} onChange={(v) => onUpdate({ shares: v })} placeholder="e.g. 100" />
          <InputRow label="Price/share ($)" prefix="$" value={card.pricePerShare} onChange={(v) => onUpdate({ pricePerShare: v })} placeholder="e.g. 150.00" />
        </div>
      ) : (
        <InputRow label="Total market value ($)" prefix="$" value={card.value} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. 15000.00" />
      )}
    </>
  )
}

function RetirementCardFields({ card, onUpdate, states }) {
  const uid = card.id || 'ret'
  return (
    <>
      <label className="card-radio">
        <input type="radio" name={`${uid}-method`} checked={card.method === 'method1'} onChange={() => onUpdate({ method: 'method1' })} />
        Simple (withdrawal − penalty − taxes)
      </label>
      <label className="card-radio">
        <input type="radio" name={`${uid}-method`} checked={card.method === 'method2'} onChange={() => onUpdate({ method: 'method2' })} />
        Per fund
      </label>
      <InputRow label="Balance" prefix="$" value={card.balance} onChange={(v) => onUpdate({ balance: v })} />
      {card.method === 'method1' && (
        <>
          <label className="card-radio">
            <input type="radio" name={`${uid}-inc`} checked={card.useTaxableIncome} onChange={() => onUpdate({ useTaxableIncome: true })} />
            Tax return (Line 15)
          </label>
          <label className="card-radio">
            <input type="radio" name={`${uid}-inc`} checked={!card.useTaxableIncome} onChange={() => onUpdate({ useTaxableIncome: false })} />
            Estimate gross
          </label>
          {card.useTaxableIncome ? (
            <InputRow label="Taxable income" prefix="$" value={card.taxableIncome} onChange={(v) => onUpdate({ taxableIncome: v })} />
          ) : (
            <InputRow label="Gross income" prefix="$" value={card.grossIncome} onChange={(v) => onUpdate({ grossIncome: v })} />
          )}
          <div className="card-row">
            <div className="card-field">
              <label>Filing</label>
              <select value={card.filingStatus} onChange={(e) => onUpdate({ filingStatus: e.target.value })}>
                <option>Single</option>
                <option>Married Filing Jointly</option>
                <option>Head of Household</option>
              </select>
            </div>
            <div className="card-field">
              <label>State</label>
              <select value={card.stateName} onChange={(e) => onUpdate({ stateName: e.target.value })}>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </>
      )}
      {card.method === 'method2' && (
        <>
          {(card.funds || []).map((f, i) => (
            <div key={i} className="card-sub">
              <div className="card-sub-header">
                <span>Fund {i + 1}</span>
                <button type="button" className="card-remove" onClick={() => {
                  const funds = (card.funds || []).filter((_, j) => j !== i)
                  onUpdate({ funds })
                }} aria-label="Remove fund">×</button>
              </div>
              <InputRow label="Ticker" type="text" value={f.ticker} onChange={(v) => {
                const funds = [...(card.funds || [])]
                funds[i] = { ...(funds[i] || {}), ticker: v }
                onUpdate({ funds })
              }} />
              <InputRow label="Balance" prefix="$" value={f.balance} onChange={(v) => {
                const funds = [...(card.funds || [])]
                funds[i] = { ...(funds[i] || {}), balance: v }
                onUpdate({ funds })
              }} />
            </div>
          ))}
          <button type="button" className="add-more" onClick={() => onUpdate({ funds: [...(card.funds || []), { ticker: '', balance: '', zakatableFraction: 0.3 }] })}>+ Add fund</button>
        </>
      )}
    </>
  )
}

function LiabilityCard({ card, expanded, inTab, onToggle, onUpdateEntry, onRemoveEntry, onRemoveCard, onAddEntry }) {
  const t = LIABILITY_TYPES.find((x) => x.id === card.type)
  const summary = getLiabilitySummary(card)
  const entries = card.entries || []
  const showBody = inTab || expanded
  return (
    <div className={`card card-liability ${showBody ? 'card-expanded' : ''} ${inTab ? 'card-in-tab' : ''}`}>
      {!inTab && (
      <div className="card-header" onClick={onToggle} onKeyDown={(e) => e.key === 'Enter' && onToggle()} role="button" tabIndex={0}>
        <span className="card-type">{t?.icon} {t?.label}</span>
        <span className="card-summary">{summary}</span>
        <span className="card-header-actions" onClick={(e) => e.stopPropagation()}>
          <InfoTooltip text={t?.tooltip} />
          <button type="button" className="card-remove" onClick={onRemoveCard} aria-label="Remove card">×</button>
        </span>
        <span className="card-chevron" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </span>
      </div>
      )}
      {showBody && (
      <div className="card-body">
        {entries.map((entry, index) => (
          <EntryDrawer
            key={entry.id}
            entry={entry}
            card={card}
            index={index}
            types={LIABILITY_TYPES}
            onUpdateEntry={onUpdateEntry}
            onRemoveEntry={onRemoveEntry}
            summary={(v => v > 0 ? formatMoney(v) : '')(Number(entry.amount) || 0)}
          >
            <InputRow label="Amount" prefix="$" value={entry.amount} onChange={(v) => onUpdateEntry(entry.id, { amount: v })} />
          </EntryDrawer>
        ))}
        <button type="button" className="add-more" onClick={onAddEntry}>+ Add another {t?.label?.toLowerCase()}</button>
      </div>
      )}
    </div>
  )
}

function InputRow({ label, prefix, value, onChange, placeholder, type = 'number' }) {
  const isNum = type === 'number'
  return (
    <div className="card-field">
      <label>{label}</label>
      <div className="input-wrap">
        {prefix && <span className="prefix">{prefix}</span>}
        <input
          type={type}
          className={prefix ? 'has-prefix' : ''}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          {...(isNum && { min: 0, step: prefix ? 0.01 : 'any' })}
        />
      </div>
    </div>
  )
}
