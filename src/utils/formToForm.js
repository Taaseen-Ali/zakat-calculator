/**
 * Converts form state to the format expected by calculateZakat.
 * Form layout matches zakat-calculator-henna.vercel.app
 * All currency amounts in formData are in the user's selected currency; we convert to USD for calculation.
 */
function toUsd(amount, currency, rates) {
  if (currency === 'USD' || !rates) return Number(amount) || 0
  const rate = rates[currency]
  if (!rate) return Number(amount) || 0
  return (Number(amount) || 0) / rate
}

export function formDataToForm(formData, nisabStandard, goldPrice, silverPrice, stateTaxRate, currency = 'USD', exchangeRates = null) {
  const rates = exchangeRates || { USD: 1 }
  const usd = (val) => toUsd(val, currency, rates)

  const {
    goldGrams,
    silverGrams,
    preciousMetalsInputMode,
    preciousMetalsValue,
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
    stateName,
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
  } = formData

  const isValueMode = preciousMetalsInputMode === 'value'
  const preciousMetalsValueUsd = isValueMode && (preciousMetalsValue != null && Number(preciousMetalsValue) > 0) ? usd(preciousMetalsValue) : 0
  const goldSilverList = isValueMode
    ? (preciousMetalsValueUsd > 0 ? [{ value: preciousMetalsValueUsd, entryLabel: 'Gold & silver' }] : [])
    : (goldGrams != null || silverGrams != null)
      ? [{ goldGrams: goldGrams ?? '', silverGrams: silverGrams ?? '', entryLabel: 'Gold & silver' }]
      : []

  const cashList = (cashAndSavings != null && Number(cashAndSavings) > 0)
    ? [{ amount: usd(cashAndSavings), entryLabel: 'Cash' }]
    : []

  const stocksShortList = (stocksShortTerm != null && Number(stocksShortTerm) > 0)
    ? [{ value: usd(stocksShortTerm), entryLabel: 'Trading' }]
    : []

  // Normalize cryptoList: each entry needs { name, value, entryLabel } — value = amount*price or value field (all in USD)
  const normalizedCryptoList = (cryptoList || []).map((c) => {
    const amount = Number(c.amount) || 0
    const price = usd(c.price)
    const value = amount && price ? amount * price : usd(c.value)
    return {
      name: c.name || '',
      value,
      entryLabel: c.entryLabel || c.name || 'Crypto',
      isTrading: c.isTrading !== false
    }
  })

  // Normalize stocksLongTermList: each entry needs { ticker, marketValue, zakatableFraction, entryLabel }
  const normalizedStocksLongTermList = (stocksLongTermList || []).map((t) => {
    const mode = t.stocksInputMode || 'per_share'
    const marketValue = mode === 'total'
      ? usd(t.value)
      : (Number(t.shares) || 0) * usd(t.pricePerShare)
    return {
      ticker: t.ticker || '',
      marketValue,
      zakatableFraction: t.zakatableFraction !== undefined ? t.zakatableFraction : 0.30,
      entryLabel: t.entryLabel || t.ticker || 'Stock'
    }
  })

  const liabilityListsByType = {
    credit_card: (creditCard != null && Number(creditCard) > 0) ? [{ amount: usd(creditCard), entryLabel: 'Credit card' }] : [],
    mortgage: (mortgageNextPrincipal != null && Number(mortgageNextPrincipal) > 0) ? [{ amount: usd(mortgageNextPrincipal), entryLabel: 'Mortgage' }] : [],
    personal_loan: (personalLoans != null && Number(personalLoans) > 0) ? [{ amount: usd(personalLoans), entryLabel: 'Personal loans' }] : [],
    money_owed: (moneyOwed != null && Number(moneyOwed) > 0) ? [{ amount: usd(moneyOwed), entryLabel: 'Money owed' }] : [],
    unpaid_taxes: (unpaidTaxesBills != null && Number(unpaidTaxesBills) > 0) ? [{ amount: usd(unpaidTaxesBills), entryLabel: 'Unpaid taxes' }] : [],
    unpaid_zakat: (unpaidZakatPrior != null && Number(unpaidZakatPrior) > 0) ? [{ amount: usd(unpaidZakatPrior), entryLabel: 'Unpaid zakat' }] : [],
    other: (otherLiabilities != null && Number(otherLiabilities) > 0) ? [{ amount: usd(otherLiabilities), entryLabel: 'Other' }] : []
  }

  const realEstateFlippingListUsd = (realEstateFlippingList || []).map((p) => ({
    ...p,
    marketValue: usd(p.marketValue),
  }))
  const rentalListUsd = (rentalList || []).map((r) => ({
    ...r,
    balance: usd(r.balance),
  }))
  const loansListUsd = (loansList || []).map((l) => ({
    ...l,
    amount: usd(l.amount),
  }))
  const retirementFundsListUsd = (retirementFundsList || []).map((f) => ({
    ...f,
    balance: usd(f.balance),
  }))

  return {
    nisabStandard,
    goldGrams: Number(goldGrams) || 0,
    silverGrams: Number(silverGrams) || 0,
    preciousMetalsValueUsd: preciousMetalsValueUsd,
    goldSilverList,
    goldPricePerGram: goldPrice,
    silverPricePerGram: silverPrice,
    cashAndSavings: usd(cashAndSavings),
    cashList,
    stocksShortList,
    cryptoList: normalizedCryptoList,
    stocksShortTerm: usd(stocksShortTerm),
    stocksLongTermList: normalizedStocksLongTermList,
    retirementMethod: retirementMethod || 'full',
    retirementBalance: usd(retirementBalance),
    retirementFundsList: retirementFundsListUsd,
    taxableIncome: taxableIncome !== '' && taxableIncome != null ? usd(taxableIncome) : '',
    grossIncome: grossIncome !== '' && grossIncome != null ? usd(grossIncome) : '',
    useTaxableIncome: useTaxableIncome !== false,
    filingStatus: filingStatus || 'Single',
    stateName: stateName || 'New York',
    stateTaxRate: stateTaxRate ?? 0,
    realEstateFlippingList: realEstateFlippingListUsd,
    rentalList: rentalListUsd,
    businessSoleOwner: businessSoleOwner !== false,
    businessOwnershipPct: businessOwnershipPct ?? '',
    businessCash: usd(businessCash),
    businessInventory: usd(businessInventory),
    businessReceivables: usd(businessReceivables),
    businessLiabilities: usd(businessLiabilities),
    loansList: loansListUsd,
    creditCard: usd(creditCard),
    mortgageNextPrincipal: usd(mortgageNextPrincipal),
    personalLoans: usd(personalLoans),
    moneyOwed: usd(moneyOwed),
    unpaidTaxesBills: usd(unpaidTaxesBills),
    unpaidZakatPrior: usd(unpaidZakatPrior),
    otherLiabilities: usd(otherLiabilities),
    liabilityListsByType
  }
}

export const defaultFormData = {
  goldGrams: '',
  silverGrams: '',
  preciousMetalsInputMode: 'grams',
  preciousMetalsValue: '',
  cashAndSavings: '',
  cryptoList: [],
  stocksShortTerm: '',
  stocksLongTermList: [],
  retirementMethod: 'full',
  retirementBalance: '',
  retirementFundsList: [],
  taxableIncome: '',
  grossIncome: '',
  useTaxableIncome: true,
  filingStatus: 'Single',
  stateName: 'New York',
  realEstateFlippingList: [],
  rentalList: [],
  businessSoleOwner: true,
  businessOwnershipPct: '',
  businessCash: '',
  businessInventory: '',
  businessReceivables: '',
  businessLiabilities: '',
  loansList: [],
  creditCard: '',
  mortgageNextPrincipal: '',
  personalLoans: '',
  moneyOwed: '',
  unpaidTaxesBills: '',
  unpaidZakatPrior: '',
  otherLiabilities: ''
}
