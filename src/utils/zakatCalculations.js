/**
 * Zakat calculation logic — Hanafi school, Fiqh Council of North America / SeekersGuidance.
 * Nisab: gold 87.48g or silver 612.36g. Rate: 2.5%.
 */

const ZAKAT_RATE = 0.025
const NISAB_GOLD_GRAMS = 87.48
const NISAB_SILVER_GRAMS = 612.36
const EARLY_WITHDRAWAL_PENALTY = 0.10

// 2024 Federal tax brackets (single) — taxable income thresholds and rates
const FEDERAL_BRACKETS_SINGLE = [
  [0, 0.10], [11600, 0.12], [47150, 0.22], [100525, 0.24],
  [191950, 0.32], [243725, 0.35], [609350, 0.37]
]
const FEDERAL_BRACKETS_JOINT = [
  [0, 0.10], [23200, 0.12], [94300, 0.22], [201050, 0.24],
  [383900, 0.32], [487450, 0.35], [731200, 0.37]
]
const FEDERAL_BRACKETS_HOH = [
  [0, 0.10], [16550, 0.12], [63100, 0.22], [100500, 0.24],
  [191950, 0.32], [243700, 0.35], [609350, 0.37]
]

const STANDARD_DEDUCTION = { Single: 14600, 'Married Filing Jointly': 29200, 'Head of Household': 21900 }

function federalTax(taxableIncome, filingStatus) {
  const brackets = filingStatus === 'Married Filing Jointly' ? FEDERAL_BRACKETS_JOINT
    : filingStatus === 'Head of Household' ? FEDERAL_BRACKETS_HOH
    : FEDERAL_BRACKETS_SINGLE
  let tax = 0
  for (let i = 1; i < brackets.length; i++) {
    const [prevThresh, rate] = brackets[i - 1]
    const [thresh] = brackets[i]
    if (taxableIncome <= prevThresh) break
    const band = Math.min(taxableIncome, thresh) - prevThresh
    if (band > 0) tax += band * rate
  }
  if (taxableIncome > brackets[brackets.length - 1][0]) {
    tax += (taxableIncome - brackets[brackets.length - 1][0]) * brackets[brackets.length - 1][1]
  }
  return tax
}

export function nisabInDollars(goldPricePerGram, silverPricePerGram, useGoldStandard) {
  if (useGoldStandard) return (NISAB_GOLD_GRAMS * (goldPricePerGram || 0)) || 0
  return (NISAB_SILVER_GRAMS * (silverPricePerGram || 0)) || 0
}

export function estimateTaxOnWithdrawal(balance, taxableIncomeOrGross, filingStatus, stateRate, useTaxableIncome) {
  const deduction = STANDARD_DEDUCTION[filingStatus] || 14600
  const currentTaxable = useTaxableIncome ? taxableIncomeOrGross : Math.max(0, (taxableIncomeOrGross || 0) - deduction)
  const taxableWithWithdrawal = currentTaxable + balance
  const federalBefore = federalTax(currentTaxable, filingStatus)
  const federalAfter = federalTax(taxableWithWithdrawal, filingStatus)
  const federalOnWithdrawal = federalAfter - federalBefore
  const stateOnWithdrawal = (stateRate || 0) * balance
  return federalOnWithdrawal + stateOnWithdrawal
}

export function netAfterPenaltyAndTax(balance, taxableIncome, filingStatus, stateRate, useTaxableIncome) {
  const penalty = balance * EARLY_WITHDRAWAL_PENALTY
  const tax = estimateTaxOnWithdrawal(balance, taxableIncome, filingStatus, stateRate, useTaxableIncome)
  return Math.max(0, balance - penalty - tax)
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildAssetBreakdownDetailed(form, totals) {
  const {
    goldPricePerGram, silverPricePerGram, goldSilverList, cashList, stocksShortList,
    cryptoList, stocksLongTermList, retirementMethod, retirementBalance, retirementFundsList,
    taxableIncome, grossIncome, useTaxableIncome, filingStatus, stateTaxRate,
    realEstateFlippingList, rentalList, businessSoleOwner, businessOwnershipPct,
    businessCash, businessInventory, businessReceivables, businessLiabilities,
    loansList
  } = form

  const sections = []

  if ((goldSilverList || []).length > 0) {
    const entries = goldSilverList.map((e) => {
      const g = Number(e.goldGrams) || 0
      const s = Number(e.silverGrams) || 0
      const goldVal = g * (goldPricePerGram || 0)
      const silverVal = s * (silverPricePerGram || 0)
      const value = goldVal + silverVal
      const steps = []
      if (goldVal > 0) steps.push({ desc: `${g} g gold × $${goldPricePerGram}/g`, value: goldVal })
      if (silverVal > 0) steps.push({ desc: `${s} g silver × $${silverPricePerGram}/g`, value: silverVal })
      return { label: e.entryLabel || 'Gold & silver', value, steps: steps.length > 0 ? steps : null }
    }).filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'gold_silver', label: 'Gold & silver', value: totals.goldSilver, entries })
    }
  }

  if ((cashList || []).length > 0) {
    const entries = cashList
      .map((e) => ({ label: e.entryLabel || 'Cash', value: Number(e.amount) || 0 }))
      .filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'cash', label: 'Cash & savings', value: totals.cash, entries })
    }
  }

  if ((cryptoList || []).length > 0) {
    const entries = cryptoList
      .filter((c) => c.isTrading !== false && (Number(c.value) || 0) > 0)
      .map((c) => ({ label: c.entryLabel || c.name || 'Crypto', value: Number(c.value) || 0 }))
    if (entries.length > 0) {
      sections.push({ type: 'crypto', label: 'Cryptocurrency (trading)', value: totals.crypto, entries })
    }
  }

  if ((stocksShortList || []).length > 0) {
    const entries = stocksShortList
      .map((e) => ({ label: e.entryLabel || 'Stock', value: Number(e.value) || 0 }))
      .filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'stocks_short', label: 'Stocks (trading)', value: totals.stocksShort, entries })
    }
  }

  if ((stocksLongTermList || []).length > 0) {
    const entries = stocksLongTermList
      .map((t) => {
        const mv = Number(t.marketValue) || 0
        const frac = t.zakatableFraction !== undefined ? t.zakatableFraction : 0.30
        const zakatable = mv * frac
        return {
          label: t.entryLabel || t.ticker || 'Stock',
          value: zakatable,
          steps: [{ desc: `Market value $${fmt(mv)}`, value: mv }, { desc: `× ${Math.round(frac * 100)}% zakatable`, value: zakatable }]
        }
      })
      .filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'stocks_long', label: 'Stocks (long-term)', value: totals.stocksLong, entries })
    }
  }

  if (totals.retirement > 0) {
    const method = retirementMethod === 'method1' ? 'withdraw' : retirementMethod
    if (method === 'withdraw') {
      const bal = Number(retirementBalance) || 0
      const penalty = bal * EARLY_WITHDRAWAL_PENALTY
      const tax = estimateTaxOnWithdrawal(bal, useTaxableIncome ? (Number(taxableIncome) || 0) : (Number(grossIncome) || 0), filingStatus, stateTaxRate, useTaxableIncome)
      const net = Math.max(0, bal - penalty - tax)
      sections.push({
        type: 'retirement',
        label: '401(k) / IRA',
        value: totals.retirement,
        entries: [{
          label: 'Balance (net after penalty & tax)',
          value: net,
          steps: [
            { desc: `Balance`, value: bal },
            { desc: `− 10% early withdrawal penalty`, value: -penalty },
            { desc: `− estimated tax on withdrawal`, value: -tax },
            { desc: `= Zakatable amount`, value: net }
          ]
        }]
      })
    } else if (method === 'full') {
      const bal = Number(retirementBalance) || 0
      sections.push({
        type: 'retirement',
        label: '401(k) / IRA',
        value: totals.retirement,
        entries: [{
          label: 'Full balance (zakat on 100%)',
          value: bal,
          steps: [{ desc: `Balance`, value: bal }]
        }]
      })
    } else {
      const entries = (retirementFundsList || [])
        .map((f) => {
          const bal = Number(f.balance) || 0
          const frac = f.zakatableFraction !== undefined ? f.zakatableFraction : 0.30
          const zakatable = bal * frac
          return {
            label: f.ticker || f.entryLabel || 'Fund',
            value: zakatable,
            steps: bal > 0 ? [{ desc: `Balance $${fmt(bal)}`, value: bal }, { desc: `× ${Math.round(frac * 100)}% zakatable`, value: zakatable }] : null
          }
        })
        .filter((e) => e.value > 0)
      if (entries.length > 0) {
        sections.push({ type: 'retirement', label: '401(k) / IRA', value: totals.retirement, entries })
      }
    }
  }

  if ((realEstateFlippingList || []).length > 0) {
    const entries = realEstateFlippingList
      .map((e) => ({ label: e.entryLabel || e.name || 'Property', value: Number(e.marketValue) || 0 }))
      .filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'real_estate', label: 'Real estate (flipping)', value: totals.realEstate, entries })
    }
  }

  if ((rentalList || []).length > 0) {
    const entries = rentalList
      .map((e) => ({ label: e.entryLabel || e.name || 'Rental', value: Number(e.balance) || 0 }))
      .filter((e) => e.value > 0)
    if (entries.length > 0) {
      sections.push({ type: 'rental', label: 'Rental income', value: totals.rental, entries })
    }
  }

  if (totals.business > 0) {
    const net = (Number(businessCash) || 0) + (Number(businessInventory) || 0) + (Number(businessReceivables) || 0) - (Number(businessLiabilities) || 0)
    const share = businessSoleOwner ? 1 : (Number(businessOwnershipPct) || 0) / 100
    const steps = [
      { desc: 'Cash + Inventory + Receivables − Liabilities', value: Math.max(0, net) },
      { desc: `× ${businessSoleOwner ? '100' : businessOwnershipPct}% ownership`, value: totals.business }
    ]
    sections.push({ type: 'business', label: 'Business assets', value: totals.business, entries: [{ label: 'Net business assets', value: totals.business, steps }] })
  }

  const strongLoans = (loansList || []).filter((l) => l.strong && (Number(l.amount) || 0) > 0)
  if (strongLoans.length > 0) {
    const entries = strongLoans.map((l) => ({ label: l.entryLabel || l.description || 'Loan', value: Number(l.amount) || 0 }))
    sections.push({ type: 'money_lent', label: 'Money lent', value: totals.moneyLent, entries })
  }

  return sections
}

function buildLiabilityBreakdownDetailed(form, totals) {
  const typeMap = {
    credit_card: { key: 'cc', label: 'Credit card' },
    mortgage: { key: 'mortgage', label: 'Mortgage' },
    personal_loan: { key: 'personalLoansVal', label: 'Personal loans' },
    money_owed: { key: 'moneyOwedVal', label: 'Money owed' },
    unpaid_taxes: { key: 'unpaidTaxes', label: 'Unpaid taxes & bills' },
    unpaid_zakat: { key: 'unpaidZakat', label: 'Unpaid zakat' },
    other: { key: 'other', label: 'Other debt' }
  }

  const lists = form.liabilityListsByType || {}
  const sections = []

  for (const [type, { key, label }] of Object.entries(typeMap)) {
    const value = totals[key] || 0
    if (value > 0) {
      const entries = (lists[type] || [])
        .map((e) => ({ label: e.entryLabel || 'Debt', value: Number(e.amount) || 0 }))
        .filter((e) => e.value > 0)
      sections.push({ label, value, entries: entries.length > 0 ? entries : [{ label: 'Total', value }] })
    }
  }
  return sections
}

export function calculateZakat(form) {
  const {
    nisabStandard,
    goldGrams,
    silverGrams,
    goldPricePerGram,
    silverPricePerGram,
    cashAndSavings,
    cryptoList,
    stocksShortTerm,
    stocksLongTermList,
    retirementMethod,
    retirementBalance,
    retirementFundsList,
    taxableIncome,
    grossIncome,
    useTaxableIncome,
    filingStatus,
    stateTaxRate,
    realEstateFlippingList,
    rentalList,
    businessSoleOwner,
    businessOwnershipPct,
    businessCash,
    businessInventory,
    businessReceivables,
    businessLiabilities,
    loansList,
    creditCard,
    mortgageNextPrincipal,
    personalLoans,
    moneyOwed,
    unpaidTaxesBills,
    unpaidZakatPrior,
    otherLiabilities
  } = form

  const nisab = nisabInDollars(goldPricePerGram, silverPricePerGram, nisabStandard === 'gold')

  const goldSilver = (goldGrams || 0) * (goldPricePerGram || 0) + (silverGrams || 0) * (silverPricePerGram || 0)
  const cash = Number(cashAndSavings) || 0
  const crypto = (cryptoList || []).reduce((s, c) => {
    if (c.isTrading === false) return s
    return s + (Number(c.value) || 0)
  }, 0)
  const stocksShort = Number(stocksShortTerm) || 0
  const stocksLong = (stocksLongTermList || []).reduce((s, t) => s + (Number(t.marketValue) || 0) * (t.zakatableFraction !== undefined ? t.zakatableFraction : 0.30), 0)

  let retirement = 0
  const retirementBal = Number(retirementBalance) || 0
  const method = retirementMethod === 'method1' ? 'withdraw' : retirementMethod
  if (method === 'withdraw') {
    // Must withdraw from 401k to pay zakat — deduct penalty & tax from amount when calculating
    retirement = netAfterPenaltyAndTax(
      retirementBal,
      useTaxableIncome ? (Number(taxableIncome) || 0) : (Number(grossIncome) || 0),
      filingStatus,
      stateTaxRate,
      useTaxableIncome
    )
  } else if (method === 'method2') {
    retirement = (retirementFundsList || []).reduce((s, f) => s + (Number(f.balance) || 0) * (f.zakatableFraction !== undefined ? f.zakatableFraction : 0.30), 0)
  } else {
    // Full balance (default) — zakat on 100% when you have other assets to pay
    retirement = retirementBal
  }

  const realEstate = (realEstateFlippingList || []).reduce((s, p) => s + (Number(p.marketValue) || 0), 0)
  const rental = (rentalList || []).reduce((s, r) => s + (Number(r.balance) || 0), 0)

  const businessNet = (Number(businessCash) || 0) + (Number(businessInventory) || 0) + (Number(businessReceivables) || 0) - (Number(businessLiabilities) || 0)
  const businessShare = businessSoleOwner ? 1 : (Number(businessOwnershipPct) || 0) / 100
  const business = Math.max(0, businessNet) * businessShare

  const moneyLent = (loansList || []).filter(l => l.strong).reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const totalAssets = goldSilver + cash + crypto + stocksShort + stocksLong + retirement + realEstate + rental + business + moneyLent

  const cc = Number(creditCard) || 0
  const mortgage = Number(mortgageNextPrincipal) || 0
  const personalLoansVal = Number(personalLoans) || 0
  const moneyOwedVal = Number(moneyOwed) || 0
  const unpaidTaxes = Number(unpaidTaxesBills) || 0
  const unpaidZakat = Number(unpaidZakatPrior) || 0
  const other = Number(otherLiabilities) || 0

  const totalLiabilities = cc + mortgage + personalLoansVal + moneyOwedVal + unpaidTaxes + unpaidZakat + other

  const netWealth = Math.max(0, totalAssets - totalLiabilities)
  const zakatDue = netWealth >= nisab ? netWealth * ZAKAT_RATE : 0

  const assetBreakdownDetailed = buildAssetBreakdownDetailed(form, {
    goldSilver, cash, crypto, stocksShort, stocksLong, retirement, realEstate, rental, business, moneyLent
  })

  const liabilityBreakdownDetailed = buildLiabilityBreakdownDetailed(form, {
    cc, mortgage, personalLoansVal, moneyOwedVal, unpaidTaxes, unpaidZakat, other
  })

  return {
    totalZakatableAssets: totalAssets,
    totalLiabilities,
    netZakatableWealth: netWealth,
    nisab,
    zakatDue,
    rate: ZAKAT_RATE,
    meetsNisab: netWealth >= nisab,
    assetBreakdownDetailed,
    liabilityBreakdownDetailed,
    assetBreakdown: [
      { label: 'Gold & silver', value: goldSilver },
      { label: 'Cash & savings', value: cash },
      { label: 'Cryptocurrency (trading)', value: crypto },
      { label: 'Stocks (trading)', value: stocksShort },
      { label: 'Stocks (long-term)', value: stocksLong },
      { label: '401(k) / IRA', value: retirement },
      { label: 'Real estate (flipping)', value: realEstate },
      { label: 'Rental income', value: rental },
      { label: 'Business assets', value: business },
      { label: 'Money lent', value: moneyLent }
    ],
    liabilityBreakdown: [
      { label: 'Credit card', value: cc },
      { label: 'Mortgage', value: mortgage },
      { label: 'Personal loans', value: personalLoansVal },
      { label: 'Money owed', value: moneyOwedVal },
      { label: 'Unpaid taxes & bills', value: unpaidTaxes },
      { label: 'Unpaid zakat', value: unpaidZakat },
      { label: 'Other debt', value: other }
    ]
  }
}

export { ZAKAT_RATE, NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS }
