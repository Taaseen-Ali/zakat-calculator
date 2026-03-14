/**
 * Converts dashboard cards to the form format expected by calculateZakat.
 * Cards have entries array; we aggregate across entries.
 */
function getEntries(card) {
  if (card.entries && Array.isArray(card.entries)) return card.entries
  const { id, type, ...rest } = card
  return [{ id: (id || '') + '-e0', ...rest }]
}

export function cardsToForm(assetCards, liabilityCards, nisabStandard, goldPrice, silverPrice) {
  const assets = assetCards || []
  const liabilities = liabilityCards || []

  const goldSilverCard = assets.find((c) => c.type === 'gold_silver')
  const goldSilverEntries = goldSilverCard ? getEntries(goldSilverCard) : []
  const goldGrams = goldSilverEntries.reduce((s, e) => s + (Number(e.goldGrams) || 0), 0)
  const silverGrams = goldSilverEntries.reduce((s, e) => s + (Number(e.silverGrams) || 0), 0)

  const cashList = assets
    .filter((c) => c.type === 'cash')
    .flatMap((c) => getEntries(c))
    .map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel }))
  const cashTotal = cashList.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const goldSilverList = goldSilverEntries.map((e) => ({
    goldGrams: e.goldGrams ?? '',
    silverGrams: e.silverGrams ?? '',
    entryLabel: e.entryLabel
  }))

  const cryptoList = assets
    .filter((c) => c.type === 'crypto')
    .flatMap((c) => getEntries(c))
    .map((e) => {
      const amount = Number(e.amount) || 0
      const price = Number(e.price) || 0
      const value = amount && price ? amount * price : (Number(e.value) || 0)
      const isTrading = e.isTrading !== false
      return { name: e.name || '', value, entryLabel: e.entryLabel, isTrading }
    })

  const stocksShortList = assets
    .filter((c) => c.type === 'stocks_short')
    .flatMap((c) => getEntries(c))
    .map((e) => {
      const mode = e.stocksInputMode || 'per_share'
      const value = mode === 'total' ? (Number(e.value) || 0) : (Number(e.shares) || 0) * (Number(e.pricePerShare) || 0)
      return { value, entryLabel: e.entryLabel }
    })
  const stocksShortTotal = stocksShortList.reduce((s, e) => s + (Number(e.value) || 0), 0)

  const stocksLongTermList = assets
    .filter((c) => c.type === 'stocks_long')
    .flatMap((c) => getEntries(c))
    .map((e) => {
      const mode = e.stocksInputMode || 'per_share'
      const marketValue = mode === 'total'
        ? (Number(e.value) || 0)
        : (Number(e.shares) || 0) * (Number(e.pricePerShare) || 0)
      return {
        ticker: e.ticker || '',
        shares: e.shares ?? '',
        pricePerShare: e.pricePerShare ?? '',
        marketValue,
        zakatableFraction: e.zakatableFraction ?? 0.3,
        entryLabel: e.entryLabel
      }
    })

  const retirementEntries = assets
    .filter((c) => c.type === 'retirement')
    .flatMap((c) => getEntries(c))
  const firstRetirement = retirementEntries[0] || {}
  const retirementMethod = firstRetirement.method ?? 'method1'
  const retirementBalance = retirementEntries.reduce((s, e) => s + (Number(e.balance) || 0), 0)
  const retirementFundsList = retirementEntries.flatMap((e) =>
    (e.funds || []).map((f) => ({
      ticker: f.ticker || '',
      balance: f.balance ?? '',
      zakatableFraction: f.zakatableFraction ?? 0.3,
      entryLabel: e.entryLabel
    }))
  )
  const useTaxableIncome = firstRetirement.useTaxableIncome !== false
  const taxableIncome = firstRetirement.taxableIncome ?? ''
  const grossIncome = firstRetirement.grossIncome ?? ''
  const filingStatus = firstRetirement.filingStatus ?? 'Single'
  const stateName = firstRetirement.stateName ?? 'New York'

  const realEstateFlippingList = assets
    .filter((c) => c.type === 'real_estate')
    .flatMap((c) => getEntries(c))
    .map((e) => ({ name: e.name || '', marketValue: e.marketValue ?? '', entryLabel: e.entryLabel }))

  const rentalList = assets
    .filter((c) => c.type === 'rental')
    .flatMap((c) => getEntries(c))
    .map((e) => ({ name: e.name || '', balance: e.balance ?? '', entryLabel: e.entryLabel }))

  const businessEntries = assets
    .filter((c) => c.type === 'business')
    .flatMap((c) => getEntries(c))
  const firstBusiness = businessEntries[0] || {}
  const businessSoleOwner = firstBusiness.soleOwner !== false
  const businessOwnershipPct = firstBusiness.ownershipPct ?? ''
  const businessCash = businessEntries.reduce((s, e) => s + (Number(e.cash) || 0), 0)
  const businessInventory = businessEntries.reduce((s, e) => s + (Number(e.inventory) || 0), 0)
  const businessReceivables = businessEntries.reduce((s, e) => s + (Number(e.receivables) || 0), 0)
  const businessLiabilities = businessEntries.reduce((s, e) => s + (Number(e.liabilities) || 0), 0)

  const loansList = assets
    .filter((c) => c.type === 'money_lent')
    .flatMap((c) => getEntries(c))
    .map((e) => ({ description: e.description || '', amount: e.amount ?? '', strong: e.strong !== false, entryLabel: e.entryLabel }))

  const sumByType = (type) =>
    liabilities
      .filter((c) => c.type === type)
      .flatMap((c) => getEntries(c))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const liabilityListsByType = {
    credit_card: liabilities.filter((c) => c.type === 'credit_card').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    mortgage: liabilities.filter((c) => c.type === 'mortgage').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    personal_loan: liabilities.filter((c) => c.type === 'personal_loan').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    money_owed: liabilities.filter((c) => c.type === 'money_owed').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    unpaid_taxes: liabilities.filter((c) => c.type === 'unpaid_taxes').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    unpaid_zakat: liabilities.filter((c) => c.type === 'unpaid_zakat').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel })),
    other: liabilities.filter((c) => c.type === 'other').flatMap((c) => getEntries(c)).map((e) => ({ amount: e.amount ?? '', entryLabel: e.entryLabel }))
  }

  return {
    nisabStandard,
    goldGrams,
    silverGrams,
    goldSilverList,
    goldPricePerGram: goldPrice,
    silverPricePerGram: silverPrice,
    cashAndSavings: cashTotal,
    cashList,
    stocksShortList,
    cryptoList,
    stocksShortTerm: stocksShortTotal,
    stocksLongTermList,
    retirementMethod,
    retirementBalance,
    retirementFundsList,
    taxableIncome,
    grossIncome,
    useTaxableIncome,
    filingStatus,
    stateName,
    stateTaxRate: null, // App fills from STATE_TAX_RATES[stateName]
    realEstateFlippingList,
    rentalList,
    businessSoleOwner,
    businessOwnershipPct,
    businessCash,
    businessInventory,
    businessReceivables,
    businessLiabilities,
    loansList,
    creditCard: sumByType('credit_card'),
    mortgageNextPrincipal: sumByType('mortgage'),
    personalLoans: sumByType('personal_loan'),
    moneyOwed: sumByType('money_owed'),
    unpaidTaxesBills: sumByType('unpaid_taxes'),
    unpaidZakatPrior: sumByType('unpaid_zakat'),
    otherLiabilities: sumByType('other'),
    liabilityListsByType
  }
}
