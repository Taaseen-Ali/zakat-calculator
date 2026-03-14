/**
 * Converts form state to the format expected by calculateZakat.
 * Form layout matches zakat-calculator-henna.vercel.app
 */
export function formDataToForm(formData, nisabStandard, goldPrice, silverPrice, stateTaxRate) {
  const {
    goldGrams,
    silverGrams,
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

  const goldSilverList = (goldGrams != null || silverGrams != null)
    ? [{ goldGrams: goldGrams ?? '', silverGrams: silverGrams ?? '', entryLabel: 'Gold & silver' }]
    : []

  const cashList = (cashAndSavings != null && Number(cashAndSavings) > 0)
    ? [{ amount: cashAndSavings, entryLabel: 'Cash' }]
    : []

  const stocksShortList = (stocksShortTerm != null && Number(stocksShortTerm) > 0)
    ? [{ value: stocksShortTerm, entryLabel: 'Trading' }]
    : []

  // Normalize cryptoList: each entry needs { name, value, entryLabel } — value = amount*price or value field
  const normalizedCryptoList = (cryptoList || []).map((c) => {
    const amount = Number(c.amount) || 0
    const price = Number(c.price) || 0
    const value = amount && price ? amount * price : (Number(c.value) || 0)
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
      ? (Number(t.value) || 0)
      : (Number(t.shares) || 0) * (Number(t.pricePerShare) || 0)
    return {
      ticker: t.ticker || '',
      marketValue,
      zakatableFraction: t.zakatableFraction !== undefined ? t.zakatableFraction : 0.30,
      entryLabel: t.entryLabel || t.ticker || 'Stock'
    }
  })

  const liabilityListsByType = {
    credit_card: (creditCard != null && Number(creditCard) > 0) ? [{ amount: creditCard, entryLabel: 'Credit card' }] : [],
    mortgage: (mortgageNextPrincipal != null && Number(mortgageNextPrincipal) > 0) ? [{ amount: mortgageNextPrincipal, entryLabel: 'Mortgage' }] : [],
    personal_loan: (personalLoans != null && Number(personalLoans) > 0) ? [{ amount: personalLoans, entryLabel: 'Personal loans' }] : [],
    money_owed: (moneyOwed != null && Number(moneyOwed) > 0) ? [{ amount: moneyOwed, entryLabel: 'Money owed' }] : [],
    unpaid_taxes: (unpaidTaxesBills != null && Number(unpaidTaxesBills) > 0) ? [{ amount: unpaidTaxesBills, entryLabel: 'Unpaid taxes' }] : [],
    unpaid_zakat: (unpaidZakatPrior != null && Number(unpaidZakatPrior) > 0) ? [{ amount: unpaidZakatPrior, entryLabel: 'Unpaid zakat' }] : [],
    other: (otherLiabilities != null && Number(otherLiabilities) > 0) ? [{ amount: otherLiabilities, entryLabel: 'Other' }] : []
  }

  return {
    nisabStandard,
    goldGrams: Number(goldGrams) || 0,
    silverGrams: Number(silverGrams) || 0,
    goldSilverList,
    goldPricePerGram: goldPrice,
    silverPricePerGram: silverPrice,
    cashAndSavings: Number(cashAndSavings) || 0,
    cashList,
    stocksShortList,
    cryptoList: normalizedCryptoList,
    stocksShortTerm: Number(stocksShortTerm) || 0,
    stocksLongTermList: normalizedStocksLongTermList,
    retirementMethod: retirementMethod || 'full',
    retirementBalance: Number(retirementBalance) || 0,
    retirementFundsList: retirementFundsList || [],
    taxableIncome: taxableIncome ?? '',
    grossIncome: grossIncome ?? '',
    useTaxableIncome: useTaxableIncome !== false,
    filingStatus: filingStatus || 'Single',
    stateName: stateName || 'New York',
    stateTaxRate: stateTaxRate ?? 0,
    realEstateFlippingList: realEstateFlippingList || [],
    rentalList: rentalList || [],
    businessSoleOwner: businessSoleOwner !== false,
    businessOwnershipPct: businessOwnershipPct ?? '',
    businessCash: Number(businessCash) || 0,
    businessInventory: Number(businessInventory) || 0,
    businessReceivables: Number(businessReceivables) || 0,
    businessLiabilities: Number(businessLiabilities) || 0,
    loansList: loansList || [],
    creditCard: Number(creditCard) || 0,
    mortgageNextPrincipal: Number(mortgageNextPrincipal) || 0,
    personalLoans: Number(personalLoans) || 0,
    moneyOwed: Number(moneyOwed) || 0,
    unpaidTaxesBills: Number(unpaidTaxesBills) || 0,
    unpaidZakatPrior: Number(unpaidZakatPrior) || 0,
    otherLiabilities: Number(otherLiabilities) || 0,
    liabilityListsByType
  }
}

export const defaultFormData = {
  goldGrams: '',
  silverGrams: '',
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
