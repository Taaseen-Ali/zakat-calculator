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
          {...(isNum && { min: 0, step: prefix ? 0.01 : 'any' })}
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
    <button type="button" className="section-help-show" onClick={() => setExpanded(true)}>
      Show explanation
    </button>
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

  const updateForm = (updates) => setFormData((prev) => ({ ...prev, ...updates }))
  const updateList = (key, updater) => setFormData((prev) => ({ ...prev, [key]: updater(prev[key] || []) }))

  const [showCalculation, setShowCalculation] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const resultRef = useRef(null)

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

  const addCrypto = () => updateList('cryptoList', (list) => [...list, { id: uid(), name: '', coinId: '', amount: '', price: '', value: '', isTrading: true, entryLabel: `Crypto ${(list?.length || 0) + 1}` }])
  const updateCrypto = (index, data) => updateList('cryptoList', (list) => list.map((c, i) => (i === index ? { ...c, ...data } : c)))
  const removeCrypto = (index) => updateList('cryptoList', (list) => list.filter((_, i) => i !== index))

  const addStocksLong = () => updateList('stocksLongTermList', (list) => [...list, { id: uid(), ticker: '', shares: '', pricePerShare: '', value: '', zakatableFraction: 0.3, stocksInputMode: 'per_share', entryLabel: '' }])
  const updateStocksLong = (index, data) => updateList('stocksLongTermList', (list) => list.map((t, i) => (i === index ? { ...t, ...data } : t)))
  const removeStocksLong = (index) => updateList('stocksLongTermList', (list) => list.filter((_, i) => i !== index))

  const addRealEstate = () => updateList('realEstateFlippingList', (list) => [...list, { id: uid(), name: '', marketValue: '', entryLabel: `Property ${(list?.length || 0) + 1}` }])
  const updateRealEstate = (index, data) => updateList('realEstateFlippingList', (list) => list.map((p, i) => (i === index ? { ...p, ...data } : p)))
  const removeRealEstate = (index) => updateList('realEstateFlippingList', (list) => list.filter((_, i) => i !== index))

  const addRental = () => updateList('rentalList', (list) => [...list, { id: uid(), name: '', balance: '', entryLabel: `Rental ${(list?.length || 0) + 1}` }])
  const updateRental = (index, data) => updateList('rentalList', (list) => list.map((r, i) => (i === index ? { ...r, ...data } : r)))
  const removeRental = (index) => updateList('rentalList', (list) => list.filter((_, i) => i !== index))

  const addLoan = () => updateList('loansList', (list) => [...list, { id: uid(), description: '', amount: '', strong: true, entryLabel: `Loan ${(list?.length || 0) + 1}` }])
  const updateLoan = (index, data) => updateList('loansList', (list) => list.map((l, i) => (i === index ? { ...l, ...data } : l)))
  const removeLoan = (index) => updateList('loansList', (list) => list.filter((_, i) => i !== index))

  const addRetirementFund = () => updateList('retirementFundsList', (list) => [...list, { id: uid(), ticker: '', balance: '', zakatableFraction: 0.3, entryLabel: `Fund ${(list?.length || 0) + 1}` }])
  const updateRetirementFund = (index, data) => updateList('retirementFundsList', (list) => list.map((f, i) => (i === index ? { ...f, ...data } : f)))
  const removeRetirementFund = (index) => updateList('retirementFundsList', (list) => list.filter((_, i) => i !== index))

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
          <h1 className="dashboard-title">Zakat Calculator</h1>
        </div>
        <div className="dashboard-meta">
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
            <span className="result-amount">${result.zakatDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="nisab-selector">
            <div className="nisab-selector-header">
              <span className="nisab-selector-label">Nisab threshold</span>
              <InfoTooltip text="Think of nisab like a line. If your money is above this line, you give zakat. If it's below, you don't have to. You can measure it with gold (85g) or silver (595g)." />
            </div>
            <p className="nisab-selector-desc">Minimum wealth for zakat to be due</p>
            <div className="nisab-pill">
              <button type="button" className={nisabStandard === 'gold' ? 'active' : ''} onClick={() => setNisabStandard('gold')}>Gold 85g</button>
              <button type="button" className={nisabStandard === 'silver' ? 'active' : ''} onClick={() => setNisabStandard('silver')}>Silver 595g</button>
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
                  <span className="calc-step-label">Net wealth below nisab. No zakat due.</span>
                  <span className="calc-step-value">$0.00</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="form-layout">
        <FormSection title="Personal Assets" subtitle="Gold & silver, cash, crypto, stocks, and retirement accounts" defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Precious Metals</span>
            </div>
            <SectionHelp text="We multiply how much you have (in grams) by today's price to get the value. All of it counts toward zakat. Use the ↻ button to refresh prices." />
            <div className="card-row">
              <InputRow label="Gold owned (grams)" value={formData.goldGrams} onChange={(v) => updateForm({ goldGrams: v })} placeholder="e.g. 50" />
              <div className="card-field">
                <label>Gold price / gram</label>
                <div className="input-wrap">
                  <span className="prefix">$</span>
                  <input type="number" className="input has-prefix" value={goldPrice ?? ''} readOnly placeholder="Loads on page load" />
                </div>
              </div>
            </div>
            <div className="card-row">
              <InputRow label="Silver owned (grams)" value={formData.silverGrams} onChange={(v) => updateForm({ silverGrams: v })} placeholder="e.g. 200" />
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
            <InputRow label="Cash and bank savings" prefix="$" value={formData.cashAndSavings} onChange={(v) => updateForm({ cashAndSavings: v })} placeholder="e.g. 10000" />
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>Cryptocurrency</span>
            </div>
            <SectionHelp text="Crypto is treated like something you bought to sell, not like money. If you're holding it to trade (buy and sell soon), it counts. If you're holding it long-term, it doesn't." />
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
              <InputRow label="Total market value" prefix="$" value={formData.stocksShortTerm} onChange={(v) => updateForm({ stocksShortTerm: v })} placeholder="e.g. 15000" />
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
              <div className="card-pill">
                <button type="button" className={(formData.retirementMethod || 'full') === 'full' ? 'active' : ''} onClick={() => updateForm({ retirementMethod: 'full' })}>Full balance</button>
                <button type="button" className={formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1' ? 'active' : ''} onClick={() => updateForm({ retirementMethod: 'withdraw' })}>Must withdraw to pay</button>
                <button type="button" className={formData.retirementMethod === 'method2' ? 'active' : ''} onClick={() => updateForm({ retirementMethod: 'method2' })}>Per fund</button>
              </div>
            </div>
            {(formData.retirementMethod || 'full') === 'full' ? (
              <InputRow label="401(k) / IRA balance" prefix="$" value={formData.retirementBalance} onChange={(v) => updateForm({ retirementBalance: v })} />
            ) : (formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1') ? (
              <>
                <InputRow label="401(k) / IRA balance" prefix="$" value={formData.retirementBalance} onChange={(v) => updateForm({ retirementBalance: v })} />
                <div className="card-field">
                  <label>How would you like to enter your income?</label>
                  <div className="card-pill">
                    <button type="button" className={formData.useTaxableIncome ? 'active' : ''} onClick={() => updateForm({ useTaxableIncome: true })}>Tax return (Line 15)</button>
                    <button type="button" className={!formData.useTaxableIncome ? 'active' : ''} onClick={() => updateForm({ useTaxableIncome: false })}>Estimate gross</button>
                  </div>
                </div>
                <div className="card-row">
                  <div className="card-field">
                    <label>Filing status</label>
                    <select value={formData.filingStatus} onChange={(e) => updateForm({ filingStatus: e.target.value })}>
                      <option>Single</option>
                      <option>Married Filing Jointly</option>
                      <option>Head of Household</option>
                    </select>
                  </div>
                  <div className="card-field">
                    <label>State</label>
                    <select value={formData.stateName} onChange={(e) => updateForm({ stateName: e.target.value })}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {formData.useTaxableIncome ? (
                  <InputRow label="Taxable Income (Line 15)" prefix="$" value={formData.taxableIncome} onChange={(v) => updateForm({ taxableIncome: v })} />
                ) : (
                  <InputRow label="Estimated gross annual income" prefix="$" value={formData.grossIncome} onChange={(v) => updateForm({ grossIncome: v })} />
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
                <button type="button" className={formData.businessSoleOwner ? 'active' : ''} onClick={() => updateForm({ businessSoleOwner: true })}>Sole Owner</button>
                <button type="button" className={!formData.businessSoleOwner ? 'active' : ''} onClick={() => updateForm({ businessSoleOwner: false })}>Partial Owner</button>
              </div>
            </div>
            {!formData.businessSoleOwner && (
              <InputRow label="Ownership %" value={formData.businessOwnershipPct} onChange={(v) => updateForm({ businessOwnershipPct: v })} placeholder="e.g. 40" />
            )}
            <InputRow label="Business cash" prefix="$" value={formData.businessCash} onChange={(v) => updateForm({ businessCash: v })} />
            <InputRow label="Inventory" prefix="$" value={formData.businessInventory} onChange={(v) => updateForm({ businessInventory: v })} />
            <InputRow label="Receivables" prefix="$" value={formData.businessReceivables} onChange={(v) => updateForm({ businessReceivables: v })} />
            <InputRow label="Business liabilities" prefix="$" value={formData.businessLiabilities} onChange={(v) => updateForm({ businessLiabilities: v })} />
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
            <InputRow label="Credit card balances" prefix="$" value={formData.creditCard} onChange={(v) => updateForm({ creditCard: v })} />
            <InputRow label="Mortgage (next principal payment)" prefix="$" value={formData.mortgageNextPrincipal} onChange={(v) => updateForm({ mortgageNextPrincipal: v })} />
            <InputRow label="Personal loans due this year" prefix="$" value={formData.personalLoans} onChange={(v) => updateForm({ personalLoans: v })} />
            <InputRow label="Money owed to family or friends" prefix="$" value={formData.moneyOwed} onChange={(v) => updateForm({ moneyOwed: v })} />
            <InputRow label="Unpaid taxes & bills" prefix="$" value={formData.unpaidTaxesBills} onChange={(v) => updateForm({ unpaidTaxesBills: v })} />
            <InputRow label="Unpaid zakat from previous years" prefix="$" value={formData.unpaidZakatPrior} onChange={(v) => updateForm({ unpaidZakatPrior: v })} />
            <InputRow label="Other liabilities" prefix="$" value={formData.otherLiabilities} onChange={(v) => updateForm({ otherLiabilities: v })} />
          </div>
        </FormSection>
      </div>

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
        <span>{entry.entryLabel || entry.name || 'Crypto'}</span>
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
          onCoinSelect={(c) => onUpdate({ coinId: c.id, name: c.name, price: c.price != null ? String(c.price) : '' })}
        />
      </div>
      <div className="card-row">
        <InputRow label="Amount held" value={entry.amount} onChange={(v) => onUpdate({ amount: v })} placeholder="e.g. 0.5" />
        <div className="card-field">
          <label>Price per coin ($)</label>
          <div className="input-with-refresh">
            <div className="input-wrap">
              <span className="prefix">$</span>
              <input type="number" className="input has-prefix" value={entry.price ?? ''} onChange={(e) => onUpdate({ price: e.target.value })} placeholder="Auto-filled" min="0" step="0.01" />
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
