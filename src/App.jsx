import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { calculateZakat } from './utils/zakatCalculations'
import { STATE_TAX_RATES, STATES } from './utils/stateTaxRates'
import { formDataToForm, defaultFormData } from './utils/formToForm'
import { fetchMetalPrices } from './utils/metalPrices'
import { fetchExchangeRates, CURRENCIES, convertFromUSD, getCurrencySymbol, formatCurrency } from './utils/exchangeRates'
import { exportZakatReport } from './utils/exportPdf'
import { fetchCryptoPrices } from './utils/cryptoApi'
import { TickerAutocomplete } from './components/TickerAutocomplete'
import { CryptoAutocomplete } from './components/CryptoAutocomplete'
import { CurrencyAmount } from './components/CurrencyAmount'
import { FikrSiteHeader } from './components/FikrSiteHeader'
import { useLanguage, t, LANGUAGES } from './i18n'
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

function InputRow({ label, prefix, value, onChange, placeholder, type = 'number', currency, exchangeRates, readOnly }) {
  const isNum = type === 'number'
  const isCurrency = prefix && currency && exchangeRates
  const prefixDisplay = isCurrency ? getCurrencySymbol(currency) : prefix
  const step = isCurrency ? 0.01 : (prefix ? 0.01 : 'any')
  return (
    <div className="card-field">
      <label>{label}</label>
      <div className="input-wrap" data-prefix-len={prefixDisplay ? prefixDisplay.length : 0}>
        {prefixDisplay && <span className="prefix">{prefixDisplay}</span>}
        <input
          type={type}
          className={`input ${prefixDisplay ? 'has-prefix' : ''}`}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          {...(isNum && { min: 0, step, inputMode: prefixDisplay ? 'decimal' : 'numeric' })}
        />
      </div>
    </div>
  )
}

function InfoTooltip({ text, onRefresh, refreshing }) {
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
          {text.split('\n\n').map((part, i) =>
            i === 0 ? <p key={i} style={{ margin: 0 }}>{part}</p> : (
              <div key={i} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em', opacity: 0.85 }}>
                <span>{part}</span>
                {onRefresh && <button type="button" onClick={onRefresh} disabled={refreshing} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '1em' }} title="Refresh prices">{refreshing ? '…' : '↻'}</button>}
              </div>
            )
          )}
        </div>,
        document.body
      )}
    </>
  )
}

function HideSensitiveSwitch({ checked, onChange, className = '', label = 'Hide sensitive numbers' }) {
  return (
    <label className={`hide-sensitive-switch ${className}`}>
      <span className="hide-sensitive-label">{label}</span>
      <span className="hide-sensitive-toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="hide-sensitive-slider" />
      </span>
    </label>
  )
}

function SectionHelp({ text, compact, hideLabel = 'Hide', showLabel = 'Show explanation' }) {
  const [expanded, setExpanded] = useState(true)
  if (!text) return null
  if (expanded) {
    return (
      <div className={`section-help ${compact ? 'section-help--compact' : ''}`}>
        <p className="section-help-text">{text}</p>
        <button type="button" className="section-help-hide" onClick={() => setExpanded(false)} aria-label="Hide explanation">
          {hideLabel}
        </button>
      </div>
    )
  }
  return (
    <span className="section-help-show-wrap">
      <span className="section-help-show-icon" aria-hidden>?</span>
      <button type="button" className="section-help-show" onClick={() => setExpanded(true)}>
        {showLabel}
      </button>
    </span>
  )
}

export default function App() {
  const [theme, setTheme] = useLocalState('fikr-theme', 'light')
  const [currency, setCurrency] = useLocalState('fikr-currency', 'USD')
  const [exchangeRates, setExchangeRates] = useState(null)
  const [nisabStandard, setNisabStandard] = useLocalState('fikr-nisab', 'gold')
  const [formData, setFormData] = useLocalState('fikr-formData', defaultFormData, migrateFormData)
  const [lang, setLanguage] = useLanguage()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  const [pricesLoading, setPricesLoading] = useState(true)
  const [liveGold, setLiveGold] = useState(null)
  const [liveSilver, setLiveSilver] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [metalRes, ratesRes] = await Promise.all([
        fetchMetalPrices(),
        fetchExchangeRates(),
      ])
      if (cancelled) return
      setLiveGold(metalRes.gold)
      setLiveSilver(metalRes.silver)
      setExchangeRates(ratesRes)
      setPricesLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function refreshMetalPrices() {
    setPricesLoading(true)
    const [metalRes, ratesRes] = await Promise.all([
      fetchMetalPrices(),
      fetchExchangeRates(true),
    ])
    setLiveGold(metalRes.gold)
    setLiveSilver(metalRes.silver)
    setExchangeRates(ratesRes)
    setPricesLoading(false)
  }

  const goldPrice = liveGold
  const silverPrice = liveSilver

  const form = formDataToForm(formData, nisabStandard, goldPrice, silverPrice, STATE_TAX_RATES[formData.stateName] ?? 0, currency, exchangeRates)
  const result = calculateZakat(form)


  const [showCalculation, setShowCalculation] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [stickyBarMinimized, setStickyBarMinimized] = useLocalState('fikr-stickyBarMinimized', false)
  const [zakatCalculated, setZakatCalculated] = useState(false)
  const [hideSensitiveNumbers, setHideSensitiveNumbers] = useLocalState('fikr-hideSensitive', false)
  const resultRef = useRef(null)

  const currencyProps = { currency, exchangeRates, hideSensitiveNumbers }
  const curr = exchangeRates && exchangeRates[currency] ? currency : 'USD'
  const priceFmt = (usd) => hideSensitiveNumbers ? 'XXX' : `${getCurrencySymbol(curr)}${formatCurrency(convertFromUSD(usd ?? 0, curr, exchangeRates || { USD: 1 }), curr, 2)}`
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
  const updateStocksLong = (index, data) => updateListWithReset('stocksLongTermList', (list) => list.map((s, i) => (i === index ? { ...s, ...data } : s)))
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

  const hideLabel = t('hideNumbers', lang)

  const stickyBarEl = (
    <div className={`zakat-sticky-bar ${showStickyBar ? '' : 'hidden'} ${stickyBarMinimized ? 'minimized' : ''}`} aria-hidden={!showStickyBar}>
        <div className="zakat-sticky-bar-inner">
          <div className="zakat-sticky-bar-content">
            <span className="zakat-sticky-bar-label">{t('assets', lang)}</span>
            <span className="zakat-sticky-bar-label">{t('liabilities', lang)}</span>
            <span className="zakat-sticky-bar-label">{t('zakatDue', lang)}</span>
            <span className="zakat-sticky-bar-amount"><CurrencyAmount usdAmount={result.totalZakatableAssets} {...currencyProps} /></span>
            <span className="zakat-sticky-bar-amount"><CurrencyAmount usdAmount={result.totalLiabilities} negative {...currencyProps} /></span>
            {zakatCalculated ? (
              <div className="zakat-sticky-bar-amount-cell">
                <span className="zakat-sticky-bar-amount"><CurrencyAmount usdAmount={result.zakatDue} dec={2} {...currencyProps} /></span>
              <button
                type="button"
                className="zakat-sticky-bar-see-calc"
                onClick={() => {
                  resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setShowCalculation(true)
                }}
              >
                {t('seeCalculation', lang)}
              </button>
            </div>
          ) : (
            <div className="zakat-sticky-bar-amount-cell zakat-sticky-bar-amount-cell-full">
              <button type="button" className="zakat-sticky-bar-calc" onClick={() => setZakatCalculated(true)}>{t('calculateZakat', lang)}</button>
            </div>
          )}
          </div>
          <HideSensitiveSwitch checked={hideSensitiveNumbers} onChange={setHideSensitiveNumbers} className="hide-sensitive-switch--sticky" label={hideLabel} />
        </div>
        {stickyBarMinimized && (
          <div className="zakat-sticky-bar-brand">
            <span className="zakat-sticky-bar-title">FIKR {t('appTitle', lang)}</span>
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
  )

  return (
    <div className="app-wrap">
      <FikrSiteHeader />
      {createPortal(stickyBarEl, document.body)}
      <div className="dashboard">
      <header className="dashboard-header" dir="ltr">
        <div className="dashboard-brand">
          <div className="dashboard-brand-text">
            <span className="dashboard-logo">FIKR</span>
            <h1 className="dashboard-title">{t('appTitle', lang)}</h1>
          </div>
        </div>
        <div className="dashboard-meta">
          <button type="button" className="btn-theme-toggle" onClick={() => setTheme((th) => (th === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? t('lightMode', lang) : t('darkMode', lang)} title={theme === 'dark' ? t('lightMode', lang) : t('darkMode', lang)}>
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button type="button" className="btn-clear-form" onClick={() => { setFormData(defaultFormData); setZakatCalculated(false); }}>
            <span className="btn-clear-full">{t('clearForm', lang)}</span>
            <span className="btn-clear-short">{t('clearFormShort', lang)}</span>
          </button>
          <div className="dashboard-meta-spacer" />
          <div className="currency-selector-wrap">
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value)}
              className="currency-select"
              aria-label="Display language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.nativeName}</option>
              ))}
            </select>
          </div>
          <div className="currency-selector-wrap">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="currency-select"
              aria-label="Display currency"
              title="Display currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="dashboard-result" ref={resultRef}>
        <div className="result-top">
          <div className="result-main">
            <span className="result-label">{t('zakatDue', lang)}</span>
            {zakatCalculated ? (
              <span className="result-amount"><CurrencyAmount usdAmount={result.zakatDue} dec={2} {...currencyProps} /></span>
            ) : (
              <button type="button" className="result-calc-link" onClick={() => setZakatCalculated(true)}>{t('calculateZakat', lang)}</button>
            )}
          </div>
          <div className="result-top-right">
            <div className="nisab-selector">
              <div className="nisab-selector-header">
                <span className="nisab-selector-label">{t('nisabThreshold', lang)}</span>
                <InfoTooltip text={
                  t('nisabTooltip', lang) +
                  (goldPrice != null || silverPrice != null
                    ? `\n\n${t('gold', lang)}: ${pricesLoading ? '…' : priceFmt(goldPrice)}/g · ${t('silver', lang)}: ${pricesLoading ? '…' : priceFmt(silverPrice)}/g`
                    : '')
                } onRefresh={refreshMetalPrices} refreshing={pricesLoading} />
              </div>
              <div className="nisab-pill">
                <button type="button" className={nisabStandard === 'gold' ? 'active' : ''} onClick={() => { setZakatCalculated(false); setNisabStandard('gold'); }}>{t('nisabGold', lang)}</button>
                <button type="button" className={nisabStandard === 'silver' ? 'active' : ''} onClick={() => { setZakatCalculated(false); setNisabStandard('silver'); }}>{t('nisabSilver', lang)}</button>
              </div>
            </div>
          </div>
        </div>
        <div className="result-details">
          <span>{t('assets', lang)} <CurrencyAmount usdAmount={result.totalZakatableAssets} {...currencyProps} /></span>
          <span>− {t('liabilities', lang)} <CurrencyAmount usdAmount={result.totalLiabilities} {...currencyProps} /></span>
          <span>{t('nisabThreshold', lang)} <CurrencyAmount usdAmount={result.nisab} {...currencyProps} /></span>
        </div>
        <div className="result-bottom-right">
          <HideSensitiveSwitch checked={hideSensitiveNumbers} onChange={setHideSensitiveNumbers} label={hideLabel} />
        </div>
        {zakatCalculated && (
          <button type="button" className="btn-pdf" onClick={() => exportZakatReport(result, { currency, exchangeRates })}>{t('downloadPdf', lang)}</button>
        )}
        {zakatCalculated && (
        <div className="result-calculation">
          <button
            type="button"
            className="result-calculation-toggle"
            onClick={() => setShowCalculation((v) => !v)}
            aria-expanded={showCalculation}
          >
            <span>{showCalculation ? t('hideCalculation', lang) : t('showCalculation', lang)}</span>
            <svg className={`result-calculation-chevron ${showCalculation ? 'open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showCalculation && (
            <div className="result-calculation-body">
              <div className="calc-section">
                <div className="calc-section-title">{t('assets', lang)}</div>
                {(result.assetBreakdownDetailed || []).map((section) => (
                  <div key={section.type || section.label} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value"><CurrencyAmount usdAmount={section.value} dec={2} {...currencyProps} /></span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-entry-detail">
                        <div className="calc-step calc-step-entry">
                          <span className="calc-step-label">{entry.label}</span>
                          <span className="calc-step-value"><CurrencyAmount usdAmount={entry.value} dec={2} {...currencyProps} /></span>
                        </div>
                        {entry.steps?.map((step, j) => (
                          <div key={j} className="calc-step calc-step-mini">
                            <span className="calc-step-label">{step.desc}</span>
                            <span className="calc-step-value"><CurrencyAmount usdAmount={step.value} dec={2} signed {...currencyProps} /></span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">{t('totalZakatableAssets', lang)}</span>
                  <span className="calc-step-value"><CurrencyAmount usdAmount={result.totalZakatableAssets} dec={2} {...currencyProps} /></span>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-section-title">{t('liabilities', lang)}</div>
                {(result.liabilityBreakdownDetailed || []).map((section, idx) => (
                  <div key={idx} className="calc-section-sub">
                    <div className="calc-step calc-step-sub calc-step-section">
                      <span className="calc-step-label">{section.label}</span>
                      <span className="calc-step-value"><CurrencyAmount usdAmount={section.value} dec={2} negative {...currencyProps} /></span>
                    </div>
                    {section.entries?.map((entry, i) => (
                      <div key={i} className="calc-step calc-step-entry">
                        <span className="calc-step-label">{entry.label}</span>
                        <span className="calc-step-value"><CurrencyAmount usdAmount={entry.value} dec={2} negative {...currencyProps} /></span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="calc-step calc-step-total">
                  <span className="calc-step-label">{t('totalLiabilities', lang)}</span>
                  <span className="calc-step-value"><CurrencyAmount usdAmount={result.totalLiabilities} dec={2} negative {...currencyProps} /></span>
                </div>
              </div>
              <div className="calc-step calc-step-equals">
                <span className="calc-step-label">{t('netZakatableWealth', lang)}</span>
                <span className="calc-step-value"><CurrencyAmount usdAmount={result.netZakatableWealth} dec={2} {...currencyProps} /></span>
              </div>
              <div className="calc-step">
                <span className="calc-step-label">{t('nisabThreshold', lang)}</span>
                <span className="calc-step-value"><CurrencyAmount usdAmount={result.nisab} dec={2} {...currencyProps} /></span>
              </div>
              {result.meetsNisab ? (
                <div className="calc-step calc-step-result">
                  <div className="calc-step-label-wrap">
                    <span className="calc-step-label">{t('zakatDue', lang)}</span>
                    <span className="calc-step-label-sub">{t('zakatRate', lang)}</span>
                  </div>
                  <span className="calc-step-value"><CurrencyAmount usdAmount={result.zakatDue} dec={2} {...currencyProps} /></span>
                </div>
              ) : (
                <div className="calc-step calc-step-result">
                  <span className="calc-step-label">{t('netBelowNisab', lang)}</span>
                  <span className="calc-step-value"><CurrencyAmount usdAmount={0} dec={2} {...currencyProps} /></span>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="form-layout">
        <FormSection title={t('sectionPersonalAssets', lang)} subtitle={t('sectionPersonalAssetsSubtitle', lang)} defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('preciousMetals', lang)}</span>
            </div>
            <SectionHelp
              text={(formData.preciousMetalsInputMode || 'grams') === 'grams' ? t('helpPreciousMetalsGrams', lang) : t('helpPreciousMetalsValue', lang)}
              hideLabel={t('hide', lang)}
              showLabel={t('showExplanation', lang)}
            />
            <div className="card-field">
              <label>{t('methodLabel', lang)}</label>
              <div className="card-pill">
                <button type="button" className={(formData.preciousMetalsInputMode || 'grams') === 'grams' ? 'active' : ''} onClick={() => updateFormWithReset({ preciousMetalsInputMode: 'grams' })}>{t('methodGrams', lang)}</button>
                <button type="button" className={formData.preciousMetalsInputMode === 'value' ? 'active' : ''} onClick={() => updateFormWithReset({ preciousMetalsInputMode: 'value' })}>{t('methodValue', lang)}</button>
              </div>
            </div>
            {(formData.preciousMetalsInputMode || 'grams') === 'grams' ? (
              <>
            <div className="card-row">
              <InputRow label={t('goldOwned', lang)} value={formData.goldGrams} onChange={(v) => updateFormWithReset({ goldGrams: v })} placeholder="e.g. 50" />
              <div className="card-field">
                <label>{t('goldPricePerGram', lang)}</label>
                <div className="input-wrap" data-prefix-len={(getCurrencySymbol(exchangeRates && exchangeRates[currency] ? currency : 'USD')).length}>
                  <span className="prefix">{getCurrencySymbol(exchangeRates && exchangeRates[currency] ? currency : 'USD')}</span>
                  <input type="number" className="input has-prefix" value={goldPrice != null ? (Math.round(convertFromUSD(goldPrice, currency, exchangeRates || { USD: 1 }) * 100) / 100) : ''} readOnly placeholder={t('loadsOnPageLoad', lang)} />
                </div>
              </div>
            </div>
            <div className="card-row">
              <InputRow label={t('silverOwned', lang)} value={formData.silverGrams} onChange={(v) => updateFormWithReset({ silverGrams: v })} placeholder="e.g. 200" />
              <div className="card-field">
                <label>{t('silverPricePerGram', lang)}</label>
                <div className="input-wrap" data-prefix-len={(getCurrencySymbol(exchangeRates && exchangeRates[currency] ? currency : 'USD')).length}>
                  <span className="prefix">{getCurrencySymbol(exchangeRates && exchangeRates[currency] ? currency : 'USD')}</span>
                  <input type="number" className="input has-prefix" value={silverPrice != null ? (Math.round(convertFromUSD(silverPrice, currency, exchangeRates || { USD: 1 }) * 100) / 100) : ''} readOnly placeholder={t('loadsOnPageLoad', lang)} />
                </div>
              </div>
            </div>
              </>
            ) : (
              <>
            <InputRow label={t('totalValueGoldSilver', lang)} prefix="$" value={formData.preciousMetalsValue} onChange={(v) => updateFormWithReset({ preciousMetalsValue: v })} placeholder="e.g. 5000" currency={currency} exchangeRates={exchangeRates} />
              </>
            )}
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('cashSavings', lang)}</span>
            </div>
            <SectionHelp text={t('helpCash', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            <InputRow label={t('cashAndBankSavings', lang)} prefix="$" value={formData.cashAndSavings} onChange={(v) => updateFormWithReset({ cashAndSavings: v })} placeholder="e.g. 10000" currency={currency} exchangeRates={exchangeRates} />
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('cryptocurrency', lang)}</span>
            </div>
            <SectionHelp text={t('helpCrypto', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            {(formData.cryptoList || []).map((c, i) => (
              <CryptoFormRow key={c.id || i} entry={c} onUpdate={(d) => updateCrypto(i, d)} onRemove={() => removeCrypto(i)} currency={currency} exchangeRates={exchangeRates} lang={lang} />
            ))}
            <button type="button" className="add-more" onClick={addCrypto}>{t('addCoin', lang)}</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('stockInvestments', lang)}</span>
            </div>
            <SectionHelp text={t('helpStocks', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            <div className="form-subsubsection">
              <span className="form-subsubsection-label">{t('shortTermTrading', lang)}</span>
              <InputRow label={t('totalMarketValue', lang)} prefix="$" value={formData.stocksShortTerm} onChange={(v) => updateFormWithReset({ stocksShortTerm: v })} placeholder="e.g. 15000" currency={currency} exchangeRates={exchangeRates} />
            </div>
            <div className="form-subsubsection">
              <span className="form-subsubsection-label">{t('longTermHoldings', lang)}</span>
              {(formData.stocksLongTermList || []).map((s, i) => (
                <StocksLongFormRow key={s.id || i} entry={s} onUpdate={(d) => updateStocksLong(i, d)} onRemove={() => removeStocksLong(i)} currency={currency} exchangeRates={exchangeRates} lang={lang} />
              ))}
              <button type="button" className="add-more" onClick={addStocksLong}>{t('addLongTermStock', lang)}</button>
            </div>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('retirement', lang)}</span>
            </div>
            <SectionHelp text={t('helpRetirement', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            <div className="card-field">
              <label>{t('methodLabel', lang)}</label>
              <div className="card-pill card-pill-retirement">
                <button type="button" className={(formData.retirementMethod || 'full') === 'full' ? 'active' : ''} onClick={() => updateFormWithReset({ retirementMethod: 'full' })}>{t('retirementFullBalance', lang)}</button>
                <button type="button" className={formData.retirementMethod === 'method2' ? 'active' : ''} onClick={() => updateFormWithReset({ retirementMethod: 'method2' })}>{t('retirementPerFund', lang)}</button>
                <button type="button" className={`card-pill-full ${formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1' ? 'active' : ''}`} onClick={() => updateFormWithReset({ retirementMethod: 'withdraw' })}>{t('retirementMustWithdraw', lang)}</button>
              </div>
            </div>
            {(formData.retirementMethod || 'full') === 'full' ? (
              <InputRow label={t('retirementBalance', lang)} prefix="$" value={formData.retirementBalance} onChange={(v) => updateFormWithReset({ retirementBalance: v })} currency={currency} exchangeRates={exchangeRates} />
            ) : (formData.retirementMethod === 'withdraw' || formData.retirementMethod === 'method1') ? (
              <>
                <InputRow label={t('retirementBalance', lang)} prefix="$" value={formData.retirementBalance} onChange={(v) => updateFormWithReset({ retirementBalance: v })} currency={currency} exchangeRates={exchangeRates} />
                <div className="card-field">
                  <label>{t('howEnterIncome', lang)}</label>
                  <div className="card-pill">
                    <button type="button" className={formData.useTaxableIncome ? 'active' : ''} onClick={() => updateFormWithReset({ useTaxableIncome: true })}>{t('taxReturn', lang)}</button>
                    <button type="button" className={!formData.useTaxableIncome ? 'active' : ''} onClick={() => updateFormWithReset({ useTaxableIncome: false })}>{t('estimateGross', lang)}</button>
                  </div>
                </div>
                <div className="card-row">
                  <div className="card-field">
                    <label>{t('filingStatus', lang)}</label>
                    <select value={formData.filingStatus} onChange={(e) => updateFormWithReset({ filingStatus: e.target.value })}>
                      <option>Single</option>
                      <option>Married Filing Jointly</option>
                      <option>Head of Household</option>
                    </select>
                  </div>
                  <div className="card-field">
                    <label>{t('state', lang)}</label>
                    <select value={formData.stateName} onChange={(e) => updateFormWithReset({ stateName: e.target.value })}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {formData.useTaxableIncome ? (
                  <InputRow label={t('taxableIncome', lang)} prefix="$" value={formData.taxableIncome} onChange={(v) => updateFormWithReset({ taxableIncome: v })} currency={currency} exchangeRates={exchangeRates} />
                ) : (
                  <InputRow label={t('grossIncome', lang)} prefix="$" value={formData.grossIncome} onChange={(v) => updateFormWithReset({ grossIncome: v })} currency={currency} exchangeRates={exchangeRates} />
                )}
              </>
            ) : (
              <>
                {(formData.retirementFundsList || []).map((f, i) => (
                  <div key={f.id || i} className="card-sub">
                    <div className="card-sub-header">
                      <span>{t('fundLabel', lang)} {i + 1}</span>
                      <button type="button" className="card-remove" onClick={() => removeRetirementFund(i)} aria-label="Remove fund">×</button>
                    </div>
                    <div className="card-field">
                      <label>{t('ticker', lang)}</label>
                      <TickerAutocomplete value={f.ticker} onChange={(v) => updateRetirementFund(i, { ticker: v })} placeholder="e.g. VOO" />
                    </div>
                    <InputRow label={t('balance', lang)} prefix="$" value={f.balance} onChange={(v) => updateRetirementFund(i, { balance: v })} currency={currency} exchangeRates={exchangeRates} />
                    <InputRow label={t('zakatableFraction', lang)} value={f.zakatableFraction} onChange={(v) => updateRetirementFund(i, { zakatableFraction: parseFloat(v) || 0.3 })} placeholder="0.3" />
                  </div>
                ))}
                <button type="button" className="add-more" onClick={addRetirementFund}>{t('addFund', lang)}</button>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title={t('sectionRealEstate', lang)} subtitle={t('sectionRealEstateSubtitle', lang)} defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('realEstateFlipping', lang)}</span>
            </div>
            <SectionHelp text={t('helpRealEstateFlipping', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            {(formData.realEstateFlippingList || []).map((p, i) => (
              <div key={p.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{p.name || `${t('propertyLabel', lang)} ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeRealEstate(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label={t('propertyLabel', lang)} type="text" value={p.name} onChange={(v) => updateRealEstate(i, { name: v })} placeholder={t('placeholderProperty', lang)} />
                <InputRow label={t('marketValue', lang)} prefix="$" value={p.marketValue} onChange={(v) => updateRealEstate(i, { marketValue: v })} currency={currency} exchangeRates={exchangeRates} />
              </div>
            ))}
            <button type="button" className="add-more" onClick={addRealEstate}>{t('addProperty', lang)}</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('rentalIncome', lang)}</span>
            </div>
            <SectionHelp text={t('helpRentalIncome', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            {(formData.rentalList || []).map((r, i) => (
              <div key={r.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{r.name || `Rental ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeRental(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label={t('propertyLabel', lang)} type="text" value={r.name} onChange={(v) => updateRental(i, { name: v })} placeholder={t('placeholderRental', lang)} />
                <InputRow label={t('accountBalance', lang)} prefix="$" value={r.balance} onChange={(v) => updateRental(i, { balance: v })} currency={currency} exchangeRates={exchangeRates} />
              </div>
            ))}
            <button type="button" className="add-more" onClick={addRental}>{t('addRentalProperty', lang)}</button>
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('businessAssets', lang)}</span>
            </div>
            <SectionHelp text={t('helpBusiness', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            <div className="card-field">
              <label>{t('ownership', lang)}</label>
              <div className="card-pill">
                <button type="button" className={formData.businessSoleOwner ? 'active' : ''} onClick={() => updateFormWithReset({ businessSoleOwner: true })}>{t('soleOwner', lang)}</button>
                <button type="button" className={!formData.businessSoleOwner ? 'active' : ''} onClick={() => updateFormWithReset({ businessSoleOwner: false })}>{t('partialOwner', lang)}</button>
              </div>
            </div>
            {!formData.businessSoleOwner && (
              <InputRow label={t('ownershipPct', lang)} value={formData.businessOwnershipPct} onChange={(v) => updateFormWithReset({ businessOwnershipPct: v })} placeholder="e.g. 40" />
            )}
            <InputRow label={t('businessCash', lang)} prefix="$" value={formData.businessCash} onChange={(v) => updateFormWithReset({ businessCash: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('inventory', lang)} prefix="$" value={formData.businessInventory} onChange={(v) => updateFormWithReset({ businessInventory: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('receivables', lang)} prefix="$" value={formData.businessReceivables} onChange={(v) => updateFormWithReset({ businessReceivables: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('businessLiabilities', lang)} prefix="$" value={formData.businessLiabilities} onChange={(v) => updateFormWithReset({ businessLiabilities: v })} currency={currency} exchangeRates={exchangeRates} />
          </div>

          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('moneyLent', lang)}</span>
            </div>
            <SectionHelp text={t('helpMoneyLent', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            {(formData.loansList || []).map((l, i) => (
              <div key={l.id || i} className="card-sub">
                <div className="card-sub-header">
                  <span>{l.description || `Loan ${i + 1}`}</span>
                  <button type="button" className="card-remove" onClick={() => removeLoan(i)} aria-label="Remove">×</button>
                </div>
                <InputRow label={t('description', lang)} type="text" value={l.description} onChange={(v) => updateLoan(i, { description: v })} placeholder={t('placeholderLoanDesc', lang)} />
                <InputRow label={t('amount', lang)} prefix="$" value={l.amount} onChange={(v) => updateLoan(i, { amount: v })} currency={currency} exchangeRates={exchangeRates} />
                <label className="card-check">
                  <input type="checkbox" checked={l.strong !== false} onChange={(e) => updateLoan(i, { strong: e.target.checked })} />
                  {t('strongDebt', lang)}
                </label>
              </div>
            ))}
            <button type="button" className="add-more" onClick={addLoan}>{t('addLoan', lang)}</button>
          </div>
        </FormSection>

        <FormSection title={t('sectionDeductions', lang)} subtitle={t('sectionDeductionsSubtitle', lang)} defaultOpen={true}>
          <div className="form-subsection">
            <div className="form-subsection-header">
              <span>{t('personalLiabilities', lang)}</span>
            </div>
            <SectionHelp text={t('helpLiabilities', lang)} hideLabel={t('hide', lang)} showLabel={t('showExplanation', lang)} />
            <InputRow label={t('creditCard', lang)} prefix="$" value={formData.creditCard} onChange={(v) => updateFormWithReset({ creditCard: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('mortgageNextPrincipal', lang)} prefix="$" value={formData.mortgageNextPrincipal} onChange={(v) => updateFormWithReset({ mortgageNextPrincipal: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('personalLoans', lang)} prefix="$" value={formData.personalLoans} onChange={(v) => updateFormWithReset({ personalLoans: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('moneyOwed', lang)} prefix="$" value={formData.moneyOwed} onChange={(v) => updateFormWithReset({ moneyOwed: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('unpaidTaxes', lang)} prefix="$" value={formData.unpaidTaxesBills} onChange={(v) => updateFormWithReset({ unpaidTaxesBills: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('unpaidZakat', lang)} prefix="$" value={formData.unpaidZakatPrior} onChange={(v) => updateFormWithReset({ unpaidZakatPrior: v })} currency={currency} exchangeRates={exchangeRates} />
            <InputRow label={t('otherLiabilities', lang)} prefix="$" value={formData.otherLiabilities} onChange={(v) => updateFormWithReset({ otherLiabilities: v })} currency={currency} exchangeRates={exchangeRates} />
          </div>
        </FormSection>
      </div>

      <section className="donations-section">
        <div className="donations-header">
          <h2 className="donations-title">{t('whereToGive', lang)}</h2>
        </div>
        <p className="donations-intro">{t('donationsIntro', lang)}</p>

        <div className="donations-section-label">{t('supportFikr', lang)}</div>
        <a href="https://www.zeffy.com/en-US/donation-form/contribute-your-zakah-in-impactful-avenues" className="donations-card donations-card-fikr">
          <div>
            <div className="donations-card-title">{t('donateFikr', lang)}</div>
            <div className="donations-card-desc">{t('donateFikrDesc', lang)}</div>
          </div>
          <span className="donations-card-arrow" aria-hidden>→</span>
        </a>

        <div className="donations-section-label">{t('otherOrgs', lang)}</div>
        <div className="donations-cards">
          <a href="https://www.thirdpillar.us/" className="donations-card">
            <div>
              <div className="donations-card-title">Third Pillar</div>
              <div className="donations-card-desc">Zakat distribution · Community support</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.brighterfuturesusa.org" className="donations-card">
            <div>
              <div className="donations-card-title">Brighter Futures</div>
              <div className="donations-card-desc">Education &amp; community development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.childrenofadam.us/" className="donations-card">
            <div>
              <div className="donations-card-title">Children of Adam</div>
              <div className="donations-card-desc">Humanitarian relief &amp; development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://al-misbaah.org/pages/our-team" className="donations-card">
            <div>
              <div className="donations-card-title">Al Misbaah</div>
              <div className="donations-card-desc">Community services &amp; support</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://one-humanity.net/" className="donations-card">
            <div>
              <div className="donations-card-title">One Humanity</div>
              <div className="donations-card-desc">Global humanitarian work</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.darulihsan.com/donate/" className="donations-card">
            <div>
              <div className="donations-card-title">Darul Ihsan</div>
              <div className="donations-card-desc">Zakat &amp; community programs</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.alimdaad.com/" className="donations-card">
            <div>
              <div className="donations-card-title">Al-Imdaad Foundation</div>
              <div className="donations-card-desc">Emergency relief &amp; development</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
          <a href="https://www.jamiatsa.org/" className="donations-card">
            <div>
              <div className="donations-card-title">Jamiatul Ulama</div>
              <div className="donations-card-desc">Scholarly oversight · Zakat distribution</div>
            </div>
            <span className="donations-card-arrow" aria-hidden>→</span>
          </a>
        </div>

        <p className="donations-disclaimer">{t('donationsDisclaimer', lang)}</p>
      </section>

      <footer className="dashboard-footer">
        <p>{t('footerText', lang)} <a href="https://fikr.us">Foundation for Inquiry, Knowledge and Revival</a></p>
      </footer>
      </div>
    </div>
  )
}

function CryptoFormRow({ entry, onUpdate, onRemove, currency, exchangeRates, lang = 'en' }) {
  const [refreshing, setRefreshing] = useState(false)
  const isTrading = entry.isTrading !== false
  const curr = exchangeRates && exchangeRates[currency] ? currency : 'USD'

  async function handleRefresh() {
    if (!entry.coinId) return
    setRefreshing(true)
    const prices = await fetchCryptoPrices([entry.coinId])
    setRefreshing(false)
    if (prices[entry.coinId] != null) {
      const usd = prices[entry.coinId]
      const rates = exchangeRates || { USD: 1 }
      const inUserCurr = convertFromUSD(usd, curr, rates)
      onUpdate({ price: String(Math.round(inUserCurr * 100) / 100) })
    }
  }

  return (
    <div className="card-sub">
      <div className="card-sub-header">
        <span>{entry.entryLabel || entry.name || t('selectCoin', lang)}</span>
        <button type="button" className="card-remove" onClick={onRemove} aria-label="Remove">×</button>
      </div>
      <div className="card-field">
        <label>{t('holdingType', lang)}</label>
        <div className="card-pill">
          <button type="button" className={isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: true })}>{t('holdingTrading', lang)}</button>
          <button type="button" className={!isTrading ? 'active' : ''} onClick={() => onUpdate({ isTrading: false })}>{t('holdingLongTerm', lang)}</button>
        </div>
      </div>
      <div className="card-field">
        <label>{t('coinLabel', lang)}</label>
        <CryptoAutocomplete
          value={entry.name}
          onChange={(v) => onUpdate({ name: v })}
          onCoinSelect={(c) => {
            const rates = exchangeRates || { USD: 1 }
            const price = c.price != null ? convertFromUSD(c.price, curr, rates) : ''
            onUpdate({ coinId: c.id, name: c.name, entryLabel: c.name, price: price !== '' ? String(Math.round(price * 100) / 100) : '' })
          }}
        />
      </div>
      <div className="card-row">
        <InputRow label={t('amountHeld', lang)} value={entry.amount} onChange={(v) => onUpdate({ amount: v })} placeholder="e.g. 0.5" />
        <div className="card-field">
          <label>{t('pricePerCoin', lang)}</label>
          <div className="input-with-refresh">
            <div className="input-wrap">
              <span className="prefix">{getCurrencySymbol(curr)}</span>
              <input type="number" className="input has-prefix" value={entry.price ?? ''} onChange={(e) => onUpdate({ price: e.target.value })} placeholder={t('autoFilled', lang)} min="0" step="0.01" inputMode="decimal" />
            </div>
            <button type="button" className="btn-refresh" onClick={handleRefresh} disabled={!entry.coinId || refreshing} title="Refresh price">
              {refreshing ? '…' : '↻'}
            </button>
          </div>
        </div>
      </div>
      <InputRow label={t('orEnterTotalValue', lang)} prefix="$" value={entry.value} onChange={(v) => onUpdate({ value: v })} placeholder="If not using amount × price" currency={currency} exchangeRates={exchangeRates} />
    </div>
  )
}

function StocksLongFormRow({ entry, onUpdate, onRemove, currency, exchangeRates, lang = 'en' }) {
  const mode = entry.stocksInputMode || 'per_share'
  return (
    <div className="card-sub">
      <div className="card-sub-header">
        <span>{entry.entryLabel || entry.ticker || 'Stock'}</span>
        <button type="button" className="card-remove" onClick={onRemove} aria-label="Remove">×</button>
      </div>
      <div className="card-field">
        <label>{t('ticker', lang)}</label>
        <TickerAutocomplete value={entry.ticker} onChange={(v) => onUpdate({ ticker: v, ...(v?.trim() && { entryLabel: v.trim().toUpperCase() }) })} placeholder="e.g. AAPL" />
      </div>
      <div className="card-field">
        <label>{t('inputMethod', lang)}</label>
        <div className="card-pill">
          <button type="button" className={mode === 'per_share' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'per_share' })}>{t('perShare', lang)}</button>
          <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => onUpdate({ stocksInputMode: 'total' })}>{t('totalValue', lang)}</button>
        </div>
      </div>
      {mode === 'per_share' ? (
        <div className="card-row">
          <InputRow label={t('shares', lang)} value={entry.shares} onChange={(v) => onUpdate({ shares: v })} placeholder="e.g. 100" />
          <InputRow label={t('pricePerShare', lang)} prefix="$" value={entry.pricePerShare} onChange={(v) => onUpdate({ pricePerShare: v })} placeholder="e.g. 150.00" currency={currency} exchangeRates={exchangeRates} />
        </div>
      ) : (
        <InputRow label={t('totalMarketValue', lang)} prefix="$" value={entry.value} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. 15000.00" currency={currency} exchangeRates={exchangeRates} />
      )}
      <InputRow label={t('zakatableFraction', lang)} value={entry.zakatableFraction} onChange={(v) => onUpdate({ zakatableFraction: parseFloat(v) || 0.3 })} placeholder="0.3" />
    </div>
  )
}
