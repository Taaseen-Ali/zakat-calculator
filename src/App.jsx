import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { calculateZakat } from './utils/zakatCalculations'
import { STATE_TAX_RATES, STATES } from './utils/stateTaxRates'
import { formDataToForm, defaultFormData } from './utils/formToForm'
import { fetchMetalPrices } from './utils/metalPrices'
import { exportZakatReport } from './utils/exportPdf'
import { fetchCryptoPrices } from './utils/cryptoApi'
import { TickerAutocomplete } from './components/TickerAutocomplete'
import { CryptoAutocomplete } from './components/CryptoAutocomplete'
import './App.css'

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

function migrateFormData(parsed) {
  if (!parsed || typeof parsed !== 'object') return defaultFormData
  const keys = Object.keys(defaultFormData)
  const hasShape = keys.some((k) => k in parsed)
  if (!hasShape) return defaultFormData
  return { ...defaultFormData, ...parsed }
}

function FormSection({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="form-section">
      <button
        type="button"
        className="form-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="form-section-title">{title}</span>
        {subtitle && <span className="form-section-subtitle">{subtitle}</span>}
        <svg className={`form-section-chevron ${open ? 'open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && <div className="form-section-body">{children}</div>}
    </section>
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
          className={`input ${prefix ? 'has-prefix' : ''}`}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          {...(isNum && { min: 0, step: prefix ? 0.01 : 'any', inputMode: prefix ? 'decimal' : 'numeric' })}
        />
      </div>
    </div>
  )
}

function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const wrapRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!visible || !wrapRef.current) return
    function updatePosition() {
      if (!wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      const popoverWidth = 260
      const popoverHeight = 100
      let left = rect.left + rect.width / 2 - popoverWidth / 2
      let top = rect.top - popoverHeight - 8
      left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8))
      if (top < 8) top = rect.bottom + 8
      setPosition({ top, left })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && popoverRef.current && !popoverRef.current.contains(e.target)) setVisible(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible])

  if (!text) return null
  return (
    <>
      <span className="info-tooltip-wrap" ref={wrapRef}>
        <button
          type="button"
          className="info-tooltip-trigger"
          onClick={() => setVisible((v) => !v)}
          aria-label="What is nisab?"
        >
          i
        </button>
      </span>
      {visible && createPortal(
        <div
          ref={popoverRef}
          className="info-tooltip-popover"
          role="tooltip"
          style={{ top: position.top, left: position.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

function HideSensitiveSwitch({ checked, onChange, className = '' }) {
  return (
    <label className={`hide-sensitive-switch ${className}`}>
      <span className="hide-sensitive-label">Hide sensitive numbers</span>
      <span className="hide-sensitive-toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label="Hide sensitive numbers" />
        <span className="hide-sensitive-slider" />
      </span>
    </label>
  )
}

function SectionHelp({ text, compact }) {
  const [expanded, setExpanded] = useState(true)
  if (!text) return null
  if (expanded) {
    return (
      <div className={`section-help ${compact ? 'section-help--compact' : ''}`}>
        <p className="section-help-text">{text}</p>
        <button type="button" className="section-help-hide" onClick={() => setExpanded(false)} aria-label="Hide explanation">
          Hide
        </button>
      </div>
    )
  }
  return (
    <span className="section-help-show-wrap">
      <span className="section-help-show-icon" aria-hidden>?</span>
      <button type="button" className="section-help-show" onClick={() => setExpanded(true)}>
        Show explanation
      </button>
    </span>
  )
}

export default function App() {
  const [nisabStandard, setNisabStandard] = useLocalState('fikr-nisab', 'gold')
  const [formData, setFormData] = useLocalState('fikr-formData', defaultFormData, migrateFormData)
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

  const goldPrice = liveGold
  const silverPrice = liveSilver

  const form = formDataToForm(formData, nisabStandard, goldPrice, silverPrice, STATE_TAX_RATES[formData.stateName] ?? 0)
  const result = calculateZakat(form)


  const [showCalculation, setShowCalculation] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [stickyBarMinimized, setStickyBarMinimized] = useLocalState('fikr-stickyBarMinimized', false)
  const [zakatCalculated, setZakatCalculated] = useState(false)
  const [hideSensitiveNumbers, setHideSensitiveNumbers] = useLocalState('fikr-hideSensitive', false)
  const resultRef = useRef(null)

  const fmt = (n, dec = 0) => hideSensitiveNumbers ? 'XXX' : (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '')

  const updateFormWithReset = (updates) => {
    setZakatCalculated(false)
    setFormData((prev) => ({ ...prev, ...updates }))
  }
  const updateListWithReset = (key, updater) => {
    setZakatCalculated(false)
    setFormData((prev) => ({ ...prev, [key]: updater(prev[key] || []) }))
  }

  useEffect(() => {
    const el = resultRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const { isIntersecting, boundingClientRect } = entry
        if (isIntersecting) setShowStickyBar(false)
        else if (boundingClientRect.top < 0) setShowStickyBar(true)
        else setShowStickyBar(false)
      },
      { threshold: 0, rootMargin: '0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const addCrypto = () => updateListWithReset('cryptoList', (list) => [...list, { id: uid(), name: '', coinId: '', amount: '', price: '', value: '', isTrading: true, entryLabel: '' }])
  const updateCrypto = (index, data) => updateListWithReset('cryptoList', (list) => list.map((c, i) => (i === index ? { ...c, ...data } : c)))
  const removeCrypto = (index) => updateListWithReset('cryptoList', (list) => list.filter((_, i) => i !== index))

  const addStocksLong = () => updateListWithReset('stocksLongTermList', (list) => [...list, { id: uid(), ticker: '', shares: '', pricePerShare: '', value: '', zakatableFraction: 0.3, stocksInputMode: 'per_share', entryLabel: '' }])
  const updateStocksLong = (index, data) => updateListWithReset('stocksLongTermList', (list) => list.map((t, i) => (i === index ? { ...t, ...data } : t)))
  const removeStocksLong = (index) => updateListWithReset('stocksLongTermList', (list) => list.filter((_, i) => i !== index))

  const addRealEstate = () => updateListWithReset('realEstateFlippingList', (list) => [...list, { id: uid(), name: '', marketValue: '', entryLabel: `Property ${(list?.length || 0) + 1}` }])
  const updateRealEstate = (index, data) => updateListWithReset('realEstateFlippingList', (list) => list.map((p, i) => (i === index ? { ...p, ...data } : p)))
  const removeRealEstate = (index) => updateListWithReset('realEstateFlippingList', (list) => list.filter((_, i) => i !== index))

  const addRental = () => updateListWithReset('rentalList', (list) => [...list, { id: uid(), name: '', balance: '', entryLabel: `Rental ${(list?.length || 0) + 1}` }])
  const updateRental = (index, data) => updateListWithReset('rentalList', (list) => list.map((r, i) => (i === index ? { ...r, ...data } : r)))
  const removeRental = (index) => updateListWithReset('rentalList', (list) => list.filter((_, i) => i !== index))

  const addLoan = () => updateListWithReset('loansList', (list) => [...list, { id: uid(), description: '', amount: '', strong: true, entryLabel: `Loan ${(list?.length || 0) + 1}` }])
  const updateLoan = (index, data) => updateListWithReset('loansList', (list) => list.map((l, i) => (i === index ? { ...l, ...data } : l)))
  const removeLoan = (index) => updateListWithReset('loansList', (list) => list.filter((_, i) => i !== index))

  const addRetirementFund = () => updateListWithReset('retirementFundsList', (list) => [...list, { id: uid(), ticker: '', balance: '', zakatableFraction: 0.3, entryLabel: `Fund ${(list?.length || 0) + 1}` }])
  const updateRetirementFund = (index, data) => updateListWithReset('retirementFundsList', (list) => list.map((f, i) => (i === index ? { ...f, ...data } : f)))
  const removeRetirementFund = (index) => updateListWithReset('retirementFundsList', (list) => list.filter((_, i) => i !== index))

  return (
    <div className="dashboard">
      <div className={`zakat-sticky-bar ${showStickyBar ? '' : 'hidden'} ${stickyBarMinimized ? 'minimized' : ''}`} aria-hidden={!showStickyBar}>
        <div className="zakat-sticky-bar-inner">
          <div className="zakat-sticky-bar-content">
            <span className="zakat-sticky-bar-label">Assets</span>
            <span className="zakat-sticky-bar-label">Liabilities</span>
            <span className="zakat-sticky-bar-label">Zakat due</span>
            <span className="zakat-sticky-bar-amount">${fmt(result.totalZakatableAssets)}</span>
            <span className="zakat-sticky-bar-amount">${fmt(result.totalLiabilities)}</span>
            {zakatCalculated ? (
              <div className="zakat-sticky-bar-amount-cell">
                <span className="zakat-sticky-bar-amount">${fmt(result.zakatDue, 2)}</span>
              <button
                type="button"
                className="zakat-sticky-bar-see-calc"
                onClick={() => {
                  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setShowCalculation(true)
                }}
              >
                See calculation
              </button>
            </div>
          ) : (
            <div className="zakat-sticky-bar-amount-cell zakat-sticky-bar-amount-cell-full">
              <button type="button" className="zakat-sticky-bar-calc" onClick={() => setZakatCalculated(true)}>Calculate Zakat</button>
            </div>
          )}
          </div>
          <HideSensitiveSwitch checked={hideSensitiveNumbers} onChange={setHideSensitiveNumbers} className="hide-sensitive-switch--sticky" />
        </div>
        {stickyBarMinimized && (
          <div className="zakat-sticky-bar-brand">
            <a href="https://fikr.us" target="_blank" rel="noopener noreferrer" className="zakat-sticky-bar-logo-link" aria-label="FIKR">
              <img src={`${import.meta.env.BASE_URL}fikr-logo.png`} alt="FIKR" className="zakat-sticky-bar-logo" />
            </a>
            <span className="zakat-sticky-bar-title">FIKR Zakat Calculator</span>
          </div>
        )}
        <button
          type="button"
          className="zakat-sticky-bar-minimize"
          onClick={() => setStickyBarMinimized((m) => !m)}
          aria-label={stickyBarMinimized ? 'Expand zakat summary' : 'Minimize zakat summary'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={stickyBarMinimized ? 'chevron-up' : 'chevron-down'}>
            <path d={stickyBarMinimized ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-brand">
          <a href="https://fikr.us" target="_blank" rel="noopener noreferrer" className="header-logo-link" aria-label="FIKR">
            <img src={`${import.meta.env.BASE_URL}fikr-logo.png`} alt="FIKR" className="header-logo" />
          </a>
          <div className="dashboard-brand-text">
            <span className="dashboard-logo">FIKR</span>
            <h1 className="dashboard-title">Zakat Calculator</h1>
          </div>
        </div>
        <div className="dashboard-meta">
          <button type="button" className="btn-clear-form" onClick={() => { setFormData(defaultFormData); setZakatCalculated(false); }}>
            Clear form
          </button>
          <div className="prices-pill">
            <span>{pricesLoading ? '…' : (goldPrice != null ? `Gold $${goldPrice}/g` : 'Gold')}</span>
            <span>{pricesLoading ? '…' : (silverPrice != null ? `Silver $${silverPrice}/g` : 'Silver')}</span>
            <button type="button" onClick={refreshMetalPrices} disabled={pricesLoading} title="Refresh gold & silver prices">↻</button>
          </div>
        </div>
      </header>

      <div className="dashboard-result" ref={resultRef}>
        <div className="result-top">
          <div className="result-main">
            <span className="result-label">Zakat due</span>
            {zakatCalculated ? (
              <span className="result-amount">${fmt(result.zakatDue, 2)}</span>
            ) : (
              <button type="button" className="result-calc-link" onClick={() => setZakatCalculated(true)}>Calculate Zakat</button>
            )}
          </div>
          <div className="result-top-right">
            <div className="nisab-selector">
              <div className="nisab-selector-header">
                <span className="nisab-selector-label">Nisab threshold</span>
                <InfoTooltip text="Think of nisab like a line. If your money is above this line, you give zakat. If it's below, you don't have to. You can measure it with gold (87.48g) or silver (612.36g). Jurists give fatwa on the silver niṣāb because it is more beneficial for the needy (anfaʿ li-l-fuqarā)." />
              </div>
              <div className="nisab-pill">
                <button type="button" className={nisabStandard === 'gold' ? 'active' : ''} onClick={() => { setZakatCalculated(false); setNisabStandard('gold'); }}>Gold 87.48g</button>
                <button type="button" className={nisabStandard === 'silver' ? 'active' : ''} onClick={() => { setZakatCalculated(false); setNisabStandard('silver'); }}>Silver 612.36g</button>
              </div>
            </div>
          </div>
        </div>
        <div className="result-details">
          <span>Assets ${fmt(result.totalZakatableAssets)}</span>
          <span>− Liabilities ${fmt(result.totalLiabilities)}</span>
          <span>Nisab ${fmt(result.nisab)}</span>
        </div>
        <div className="result-bottom-right">
          <HideSensitiveSwitch checked={hideSensitiveNumbers} onChange={setHideSensitiveNumbers} />
        </div>
        {zakatCalculated && (
          <button type="button" className="btn-pdf" onClick={() => exportZakatReport(result)}>Download PDF</button>
        )}
        {zakatCalculated && (
        <div className="result-calculation">
          <button
            type="button"
            className="result-calculation-toggle"
            onClick={() => setShowCalculation((v) => !v)}
            aria-expanded={showCalculation}
          >
            <span>{showCalculation ? 'Hide' : 'Show'} calculation</span>
            <svg className={`result-calculation-chevron ${showCalculation ? 'open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showCalculation && (
            <div className="result-calculation-body">
              <div className="calc-section">
                <div className="calc-section-title">Assets</div>
                {(result.assetBreakdownDetailed || []).map((section) => (
                  <div key={section.type || section.label} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value">${fmt(section.value, 2)}</span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-entry-detail">
                        <div className="calc-step calc-step-entry">
                          <span className="calc-step-label">{entry.label}</span>
                          <span className="calc-step-value">${fmt(entry.value, 2)}</span>
                        </div>
                        {entry.steps?.map((step, j) => (
                          <div key={j} className="calc-step calc-step-mini">
                            <span className="calc-step-label">{step.desc}</span>
                            <span className="calc-step-value">{step.value >= 0 ? '$' : '−$'}{fmt(Math.abs(step.value), 2)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">Total zakatable assets</span>
                  <span className="calc-step-value">${fmt(result.totalZakatableAssets, 2)}</span>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-section-title">Liabilities</div>
                {(result.liabilityBreakdownDetailed || []).map((section, idx) => (
                  <div key={idx} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value">−${fmt(section.value, 2)}</span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-step calc-step-entry">
                        <span className="calc-step-label">{entry.label}</span>
                        <span className="calc-step-value">−${fmt(entry.value, 2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">Total liabilities</span>
                  <span className="calc-step-value">−${fmt(result.totalLiabilities, 2)}</span>
                </div>
              </div>
              <div className="calc-step calc-step-equals">
                <span className="calc-step-label">Net zakatable wealth</span>
                <span className="calc-step-value">${fmt(result.netZakatableWealth, 2)}</span>
              </div>
              <div className="calc-step">
                <span className="calc-step-label">Nisab threshold</span>
                <span className="calc-step-value">${fmt(result.nisab, 2)}</span>
              </div>
              {result.meetsNisab ? (
                <div className="calc-step calc-step-result">
                  <div className="calc-step-label-wrap">
                    <span className="calc-step-label">Zakat due</span>
                    <span className="calc-step-label-sub">(2.5% of net wealth)</span>
                  </div>
                  <span className="calc-step-value">${fmt(result.zakatDue, 2)}</span>
                </div>
              ) : (
                <div className="calc-step calc-step-result">
                  <span className="calc-step-label">Net wealth below nisab. No zakat due.</span>
                  <span className="calc-step-value">{hideSensitiveNumbers ? '$XXX' : '$0.00'}</span>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="form-layout">
        <FormSection title="Personal Assets" subtitle="Gold & silver, cash, crypto, stocks, and retirement accounts" defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Precious Metals</span>
            </div>
            <SectionHelp text="We multiply how much you have (in grams) by today's price to get the value. All of it counts toward zakat. Use the ↻ button to refresh prices." />
            <div className="card-row">
              <InputRow label="Gold owned (grams)" value={formData.goldGrams} onChange={(v) => updateFormWithReset({ goldGrams: v })} placeholder="e.g. 50" />
              <div className="card-field">
                <label>Gold price / gram</label>
                <div className="input-wrap">
                  <span className="prefix">$</span>
                  <input type="number" className="input has-prefix" value={goldPrice ?? ''} readOnly placeholder="Loads on page load" />
                </div>
              </div>
            </div>
            <div className="card-row">
              <InputRow label="Silver owned (grams)" value={formData.silverGrams} onChange={(v) => updateFormWithReset({ silverGrams: v })} placeholder="e.g. 200" />
              <div className="card-field">
                <label>Silver price / gram</label>
                <div className="input-wrap">
                  <span className="prefix">$</span>
                  <input type="number" className="input has-prefix" value={silverPrice ?? ''} readOnly placeholder="Loads on page load" />
                </div>
              </div>
            </div>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Cash & Savings</span>
            </div>
            <SectionHelp text="Add up everything in your bank: checking, savings, and cash at home. We take 2.5% of that total." />
            <InputRow label="Cash and bank savings" prefix="$" value={formData.cashAndSavings} onChange={(v) => updateFormWithReset({ cashAndSavings: v })} placeholder="e.g. 10000" />
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Cryptocurrency</span>
            </div>
            <SectionHelp text="Crypto is treated like a commodity, not like money. If you're holding it to trade (buy and sell soon), it counts. If you're holding it long-term, it doesn't." />
            {(formData.cryptoList || []).map((c, i) => (
              <CryptoFormRow key={c.id || i} entry={c} onUpdate={(d) => updateCrypto(i, d)} onRemove={() => removeCrypto(i)} />
            ))}
            <button type="button" className="add-more" onClick={addCrypto}>+ Add Coin</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Stock Investments</span>
            </div>
            <SectionHelp text="Stocks you trade: we count the full value. Stocks you hold for years: we estimate what part of each company is actually cash-like (we use 30% if we don't know). Then 2.5% of that." />
            <div className="form-subsubsection">
              <span className="form-subsubsection-label">Short-Term / Trading</span>
              <InputRow label="Total market value" prefix="$" value={formData.stocksShortTerm} onChange={(v) => updateFormWithReset({ stocksShortTerm: v })} placeholder="e.g. 15000" />
            </div>
            <div className="form-subsubsection">
              <span className="form-subsubsection-label">Long-Term Holdings</span>
              {(formData.stocksLongTermList || []).map((t, i) => (
                <StocksLongFormRow key={t.id || i} entry={t} onUpdate={(d) => updateStocksLong(i, d)} onRemove={() => removeStocksLong(i)} />
              ))}
              <button type="button" className="add-more" onClick={addStocksLong}>+ Add Long-Term Stock</button>
            </div>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>401(k) / IRA Retirement</span>
            </div>
            <SectionHelp text="Usually you pay zakat on the full amount in your 401k. But if you have no other cash and must pull from it to pay, we first subtract the penalty and taxes, then you pay zakat on what's left." />
            <div className="card-field">
              <label>Method</label>
              <div className="card-pill card-pill-retirement">
                <button type="button" className={(formData.retirementMethod || 'full') === 'full' ? 'active' : ''} onClick={() => updateFormWithReset({ retirementMethod: 'full' })}>Full balance</button>
                <button type="button" className={formData.retirementMethod === 'method2' ? 'active' : ''} onClick={() => updateFormWithReset({ retirementMethod: 'method2' })}>Per fund</button>
                <button type="button" className={`card-pill-full ${formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1' ? 'active' : ''}`} onClick={() => updateFormWithReset({ retirementMethod: 'withdraw' })}>Must withdraw to pay</button>
              </div>
            </div>
            {(formData.retirementMethod || 'full') === 'full' ? (
              <InputRow label="401(k) / IRA balance" prefix="$" value={formData.retirementBalance} onChange={(v) => updateFormWithReset({ retirementBalance: v })} />
            ) : (formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1') ? (
              <>
                <InputRow label="401(k) / IRA balance" prefix="$" value={formData.retirementBalance} onChange={(v) => updateFormWithReset({ retirementBalance: v })} />
                <div className="card-field">
                  <label>How would you like to enter your income?</label>
                  <div className="card-pill">
                    <button type="button" className={formData.useTaxableIncome ? 'active' : ''} onClick={() => updateFormWithReset({ useTaxableIncome: true })}>Tax return (Line 15)</button>
                    <button type="button" className={!formData.useTaxableIncome ? 'active' : ''} onClick={() => updateFormWithReset({ useTaxableIncome: false })}>Estimate gross</button>
                  </div>
                </div>
                <div className="card-row">
                  <div className="card-field">
                    <label>Filing status</label>
                    <select value={formData.filingStatus} onChange={(e) => updateFormWithReset({ filingStatus: e.target.value })}>
                      <option>Single</option>
                      <option>Married Filing Jointly</option>
                      <option>Head of Household</option>
                    </select>
                  </div>
                  <div className="card-field">
                    <label>State</label>
                    <select value={formData.stateName} onChange={(e) => updateFormWithReset({ stateName: e.target.value })}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {formData.useTaxableIncome ? (
                  <InputRow label="Taxable Income (Line 15)" prefix="$" value={formData.taxableIncome} onChange={(v) => updateFormWithReset({ taxableIncome: v })} />
                ) : (
                  <InputRow label="Estimated gross annual income" prefix="$" value={formData.grossIncome} onChange={(v) => updateFormWithReset({ grossIncome: v })} />
                )}
              </>
            ) : (
              <>
                {(formData.retirementFundsList || []).map((f, i) => (
                  <div key={f.id || i} className="card-sub">
                    <div className="card-sub-header">
                      <span>Fund {i + 1}</span>
                      <button type="button" className="card-remove" onClick={() => removeRetirementFund(i)} aria-label="Remove fund">×</button>
                    </div>
                    <div className="card-field">
                      <label>Ticker</label>
                      <TickerAutocomplete value={f.ticker} onChange={(v) => updateRetirementFund(i, { ticker: v })} placeholder="e.g. VOO" />
                    </div>
                    <InputRow label="Balance" prefix="$" value={f.balance} onChange={(v) => updateRetirementFund(i, { balance: v })} />
                    <InputRow label="Zakatable fraction (0–1)" value={f.zakatableFraction} onChange={(v) => updateRetirementFund(i, { zakatableFraction: parseFloat(v) || 0.3 })} placeholder="0.3" />
                  </div>
                ))}
                <button type="button" className="add-more" onClick={addRetirementFund}>+ Add Fund / ETF</button>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Real Estate & Business" subtitle="Flipping properties, rental income, business assets, and money lent" defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Real Estate: Flipping</span>
            </div>
            <SectionHelp text="A house you bought to flip and sell? That's like inventory. We count its full market value and take 2.5%." />
            {(formData.realEstateFlippingList || []).map((p, i) => (
              <div key={p.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{p.name || `Property ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeRealEstate(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label="Property" type="text" value={p.name} onChange={(v) => updateRealEstate(i, { name: v })} placeholder="e.g. 123 Main St" />
                <InputRow label="Market value" prefix="$" value={p.marketValue} onChange={(v) => updateRealEstate(i, { marketValue: v })} />
              </div>
            ))}
            <button type="button" className="add-more" onClick={addRealEstate}>+ Add Property</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Real Estate: Rental Income</span>
            </div>
            <SectionHelp text="We don't count the building. We only count the rent money you've collected and haven't spent yet, minus any expenses you paid." />
            {(formData.rentalList || []).map((r, i) => (
              <div key={r.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{r.name || `Rental ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeRental(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label="Property" type="text" value={r.name} onChange={(v) => updateRental(i, { name: v })} placeholder="e.g. Rental A" />
                <InputRow label="Account balance" prefix="$" value={r.balance} onChange={(v) => updateRental(i, { balance: v })} />
              </div>
            ))}
            <button type="button" className="add-more" onClick={addRental}>+ Add Rental Property</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Business Assets</span>
            </div>
            <SectionHelp text="Add up: cash in the business, stuff you're selling, and money people owe you. Subtract what you owe. We don't count buildings or equipment, only things that move." />
            <div className="card-field">
              <label>Ownership</label>
              <div className="card-pill">
                <button type="button" className={formData.businessSoleOwner ? 'active' : ''} onClick={() => updateFormWithReset({ businessSoleOwner: true })}>Sole Owner</button>
                <button type="button" className={!formData.businessSoleOwner ? 'active' : ''} onClick={() => updateFormWithReset({ businessSoleOwner: false })}>Partial Owner</button>
              </div>
            </div>
            {!formData.businessSoleOwner && (
              <InputRow label="Ownership %" value={formData.businessOwnershipPct} onChange={(v) => updateFormWithReset({ businessOwnershipPct: v })} placeholder="e.g. 40" />
            )}
            <InputRow label="Business cash" prefix="$" value={formData.businessCash} onChange={(v) => updateFormWithReset({ businessCash: v })} />
            <InputRow label="Inventory" prefix="$" value={formData.businessInventory} onChange={(v) => updateFormWithReset({ businessInventory: v })} />
            <InputRow label="Receivables" prefix="$" value={formData.businessReceivables} onChange={(v) => updateFormWithReset({ businessReceivables: v })} />
            <InputRow label="Business liabilities" prefix="$" value={formData.businessLiabilities} onChange={(v) => updateFormWithReset({ businessLiabilities: v })} />
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Money Lent to Others</span>
            </div>
            <SectionHelp text="If someone owes you money and they know it and can pay it back, it still counts as yours. You pay zakat on it each year. If you're not sure they'll ever pay, don't count it until you actually get it." />
            {(formData.loansList || []).map((l, i) => (
              <div key={l.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{l.description || `Loan ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeLoan(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label="Description" type="text" value={l.description} onChange={(v) => updateLoan(i, { description: v })} placeholder="e.g. Loan to friend" />
                <InputRow label="Amount" prefix="$" value={l.amount} onChange={(v) => updateLoan(i, { amount: v })} />
                <label className="card-check">
                  <input type="checkbox" checked={l.strong !== false} onChange={(e) => updateLoan(i, { strong: e.target.checked })} />
                  Strong debt (zakatable)
                </label>
              </div>
            ))}
            <button type="button" className="add-more" onClick={addLoan}>+ Add Loan</button>
          </div>
        </FormSection>

        <FormSection title="Deductions" subtitle="Personal debts currently due, deducted from your zakatable total" defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Personal Liabilities</span>
            </div>
            <SectionHelp text="We subtract debts you have to pay soon. For your mortgage, we only count the next one payment, not the whole loan." />
            <InputRow label="Credit card balances" prefix="$" value={formData.creditCard} onChange={(v) => updateFormWithReset({ creditCard: v })} />
            <InputRow label="Mortgage (next principal payment)" prefix="$" value={formData.mortgageNextPrincipal} onChange={(v) => updateFormWithReset({ mortgageNextPrincipal: v })} />
            <InputRow label="Personal loans due this year" prefix="$" value={formData.personalLoans} onChange={(v) => updateFormWithReset({ personalLoans: v })} />
            <InputRow label="Money owed to family or friends" prefix="$" value={formData.moneyOwed} onChange={(v) => updateFormWithReset({ moneyOwed: v })} />
            <InputRow label="Unpaid taxes & bills" prefix="$" value={formData.unpaidTaxesBills} onChange={(v) => updateFormWithReset({ unpaidTaxesBills: v })} />
            <InputRow label="Unpaid zakat from previous years" prefix="$" value={formData.unpaidZakatPrior} onChange={(v) => updateFormWithReset({ unpaidZakatPrior: v })} />
            <InputRow label="Other liabilities" prefix="$" value={formData.otherLiabilities} onChange={(v) => updateFormWithReset({ otherLiabilities: v })} />
          </div>
        </FormSection>
      </div>

      <section className="donations-section">
        <div className="donations-header">
          <h2 className="donations-title">Where to Give</h2>
        </div>
        <p className="donations-intro">Organizations that accept zakat for distribution to eligible recipients.</p>

        <div className="donations-section-label">Support FIKR</div>
        <a href="https://www.zeffy.com/en-US/donation-form/contribute-your-zakah-in-impactful-avenues" target="_blank" rel="noopener noreferrer" className="donations-card donations-card-fikr">
          <div>
            <div className="donations-card-title">Donate Zakat to FIKR</div>
            <div className="donations-card-desc">100% goes to eligible needy students</div>
          </div>
          <span className="donations-card-arrow" aria-hidden>→</span>
        </a>

        <div className="donations-section-label">Other reputable organizations that collect zakat, run under the supervision of competent &apos;ulama</div>
        <div className="donations-cards">
          <a href="https://www.thirdpillar.us/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Third Pillar</div>
              <div className="donations-card-desc">Zakat distribution · Community support</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.brighterfuturesusa.org" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Brighter Futures</div>
              <div className="donations-card-desc">Education &amp; community development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.childrenofadam.us/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Children of Adam</div>
              <div className="donations-card-desc">Humanitarian relief &amp; development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://al-misbaah.org/pages/our-team" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Al Misbaah</div>
              <div className="donations-card-desc">Community services &amp; support</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://one-humanity.net/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">One Humanity</div>
              <div className="donations-card-desc">Global humanitarian work</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.darulihsan.com/donate/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Darul Ihsan</div>
              <div className="donations-card-desc">Zakat &amp; community programs</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.alimdaad.com/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Al-Imdaad Foundation</div>
              <div className="donations-card-desc">Emergency relief &amp; development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.jamiatsa.org/" target="_blank" rel="noopener noreferrer" className="donations-card">
            <div>
              <div className="donations-card-title">Jamiatul Ulama</div>
              <div className="donations-card-desc">Scholarly oversight · Zakat distribution</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
        </div>

        <p className="donations-disclaimer">We are not affiliated with these organizations. Links are provided as a community service.</p>
      </section>

      <footer className="dashboard-footer">
        <p>Zakat guide by <a href="https://fikr.us" target="_blank" rel="noopener noreferrer">Foundation for Inquiry, Knowledge and Revival</a></p>
      </footer>
    </div>
  )
}

function CryptoFormRow({ entry, onUpdate, onRemove }) {
  const [refreshing, setRefreshing] = useState(false)
  const isTrading = entry.isTrading !== false

  async function handleRefresh() {
    if (!entry.coinId) return
    setRefreshing(true)
    const prices = await fetchCryptoPrices([entry.coinId])
    setRefreshing(false)
    if (prices[entry.coinId] != null) onUpdate({ price: String(prices[entry.coinId]) })
  }

  return (
    <div className="card-sub">
      <div className="card-sub-header">
        <span>{entry.entryLabel || entry.name || 'Select coin'}</span>
        <button type="button" className="card-remove" onClick={onRemove} aria-label="Remove">×</button>
      </div>
      <div className="card-field">
        <label>Holding type</label>
        <div className="card-pill">
          <button type="button" className={isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: true })}>Trading</button>
          <button type="button" className={!isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: false })}>Long-term</button>
        </div>
      </div>
      <div className="card-field">
        <label>Coin</label>
        <CryptoAutocomplete
          value={entry.name}
          onChange={(v) => onUpdate({ name: v })}
          onCoinSelect={(c) => onUpdate({ coinId: c.id, name: c.name, entryLabel: c.name, price: c.price != null ? String(c.price) : '' })}
        />
      </div>
      <div className="card-row">
        <InputRow label="Amount held" value={entry.amount} onChange={(v) => onUpdate({ amount: v })} placeholder="e.g. 0.5" />
        <div className="card-field">
          <label>Price per coin ($)</label>
          <div className="input-with-refresh">
            <div className="input-wrap">
              <span className="prefix">$</span>
              <input type="number" className="input has-prefix" value={entry.price ?? ''} onChange={(e) => onUpdate({ price: e.target.value })} placeholder="Auto-filled" min="0" step="0.01" inputMode="decimal" />
            </div>
            <button type="button" className="btn-refresh" onClick={handleRefresh} disabled={!entry.coinId || refreshing} title="Refresh price">
              {refreshing ? '…' : '↻'}
            </button>
          </div>
        </div>
      </div>
      <InputRow label="Or enter total value ($)" prefix="$" value={entry.value} onChange={(v) => onUpdate({ value: v })} placeholder="If not using amount × price" />
    </div>
  )
}

function StocksLongFormRow({ entry, onUpdate, onRemove }) {
  const mode = entry.stocksInputMode || 'per_share'
  return (
    <div className="card-sub">
      <div className="card-sub-header">
        <span>{entry.entryLabel || entry.ticker || 'Stock'}</span>
        <button type="button" className="card-remove" onClick={onRemove} aria-label="Remove">×</button>
      </div>
      <div className="card-field">
        <label>Ticker</label>
        <TickerAutocomplete value={entry.ticker} onChange={(v) => onUpdate({ ticker: v, ...(v?.trim() && { entryLabel: v.trim().toUpperCase() }) })} placeholder="e.g. AAPL" />
      </div>
      <div className="card-field">
        <label>Input method</label>
        <div className="card-pill">
          <button type="button" className={mode === 'per_share' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'per_share' })}>Per share</button>
          <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'total' })}>Total value</button>
        </div>
      </div>
      {mode === 'per_share' ? (
        <div className="card-row">
          <InputRow label="Shares" value={entry.shares} onChange={(v) => onUpdate({ shares: v })} placeholder="e.g. 100" />
          <InputRow label="Price/share ($)" prefix="$" value={entry.pricePerShare} onChange={(v) => onUpdate({ pricePerShare: v })} placeholder="e.g. 150.00" />
        </div>
      ) : (
        <InputRow label="Total market value ($)" prefix="$" value={entry.value} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. 15000.00" />
      )}
      <InputRow label="Zakatable fraction (0–1)" value={entry.zakatableFraction} onChange={(v) => onUpdate({ zakatableFraction: parseFloat(v) || 0.3 })} placeholder="0.3" />
    </div>
  )
}
