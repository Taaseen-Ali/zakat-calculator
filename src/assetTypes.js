export const ASSET_TYPES = [
  { id: 'cash', label: 'Cash & savings', icon: '💵', desc: 'Bank accounts, checking, savings', tooltip: 'Add up everything in your bank: checking, savings, and cash at home. We take 2.5% of that total.' },
  { id: 'gold_silver', label: 'Gold & silver', icon: '🥇', desc: 'Precious metals you own', tooltip: 'We multiply how much you have (in grams) by today\'s price. All of it counts toward zakat. Use the refresh button to get the latest prices.' },
  { id: 'crypto', label: 'Cryptocurrency', icon: '₿', desc: 'Bitcoin, Ethereum, etc.', tooltip: 'Crypto is treated like a commodity, not like money. If you\'re holding it to trade (buy and sell soon), it counts. If you\'re holding it long-term, it doesn\'t.' },
  { id: 'stocks_short', label: 'Stocks (trading)', icon: '📈', desc: 'Held under 1 year', tooltip: 'Stocks you bought to sell soon? We count the full value and take 2.5%.' },
  { id: 'stocks_long', label: 'Stocks (long-term)', icon: '🌱', desc: 'Held over 1 year', tooltip: 'Stocks you\'re holding for years? We estimate what part of each company is actually cash-like. If we don\'t know, we use 30%.' },
  { id: 'retirement', label: '401(k) / IRA', icon: '🏛️', desc: 'Retirement accounts', tooltip: 'Usually you pay zakat on the full amount. But if you have no other cash and must pull from your 401k to pay, we first subtract the penalty and taxes, then you pay zakat on what\'s left.' },
  { id: 'real_estate', label: 'Real estate (flipping)', icon: '🏚️', desc: 'Properties to sell', tooltip: 'A house you bought to flip and sell? That\'s like inventory. We count its full market value and take 2.5%.' },
  { id: 'rental', label: 'Rental income', icon: '🏠', desc: 'Net rental cash', tooltip: 'We don\'t count the building. We only count the rent money you\'ve collected and haven\'t spent yet, minus any expenses you paid.' },
  { id: 'business', label: 'Business assets', icon: '📊', desc: 'Cash, inventory, receivables', tooltip: 'Add up: cash in the business, stuff you\'re selling, and money people owe you. Subtract what you owe. We don\'t count buildings or equipment, only things that move.' },
  { id: 'money_lent', label: 'Money lent', icon: '🤝', desc: 'Loans you\'ve given (strong debt)', tooltip: 'If someone owes you money and they know it and can pay it back, it still counts as yours. You pay zakat on it each year. If you\'re not sure they\'ll ever pay, don\'t count it until you get it.' }
]

export const ASSET_GROUPS = [
  { label: 'Cash & equivalents', ids: ['cash', 'gold_silver', 'crypto'] },
  { label: 'Investments', ids: ['stocks_short', 'stocks_long', 'retirement'] },
  { label: 'Property', ids: ['real_estate', 'rental'] },
  { label: 'Other', ids: ['business', 'money_lent'] }
]

export const LIABILITY_TYPES = [
  { id: 'credit_card', label: 'Credit card', icon: '💳', tooltip: 'How much do you owe on all your cards right now? We subtract that from your total before we figure out zakat.' },
  { id: 'mortgage', label: 'Mortgage (next principal)', icon: '🏡', tooltip: 'Just the part of your next payment that goes toward the loan itself, not the interest. Your mortgage statement shows this.' },
  { id: 'personal_loan', label: 'Personal loan', icon: '📋', tooltip: 'Car loans, student loans, or anything you\'re paying back in monthly chunks. We count what you still owe.' },
  { id: 'money_owed', label: 'Money owed', icon: '👤', tooltip: 'Money you promised to pay back to someone, like a family member or friend.' },
  { id: 'unpaid_taxes', label: 'Unpaid taxes & bills', icon: '📄', tooltip: 'Taxes or bills you haven\'t paid yet but are due right now.' },
  { id: 'unpaid_zakat', label: 'Unpaid zakat (prior years)', icon: '🤲', tooltip: 'If you missed zakat in past years, we treat that like a debt. We subtract it from what you have this year.' },
  { id: 'other', label: 'Other debt', icon: '📌', tooltip: 'Any other money you owe that doesn\'t fit the boxes above.' }
]

export const LIABILITY_GROUPS = [
  { label: 'Consumer debt', ids: ['credit_card', 'personal_loan'] },
  { label: 'Property', ids: ['mortgage'] },
  { label: 'Other obligations', ids: ['money_owed', 'unpaid_taxes', 'unpaid_zakat', 'other'] }
]

export function defaultAssetData(type) {
  switch (type) {
    case 'cash': return { amount: '' }
    case 'gold_silver': return { goldGrams: '', silverGrams: '' }
    case 'crypto': return { name: '', coinId: '', amount: '', price: '', value: '', isTrading: true }
    case 'stocks_short': return { ticker: '', shares: '', pricePerShare: '', value: '', stocksInputMode: 'per_share' }
    case 'stocks_long': return { ticker: '', shares: '', pricePerShare: '', value: '', zakatableFraction: 0.3, stocksInputMode: 'per_share' }
    case 'retirement': return { method: 'full', balance: '', useTaxableIncome: true, taxableIncome: '', grossIncome: '', filingStatus: 'Single', stateName: 'New York', funds: [] }
    case 'real_estate': return { name: '', marketValue: '' }
    case 'rental': return { name: '', balance: '' }
    case 'business': return { soleOwner: true, ownershipPct: '', cash: '', inventory: '', receivables: '', liabilities: '' }
    case 'money_lent': return { description: '', amount: '', strong: true }
    default: return {}
  }
}

export function defaultLiabilityData(type) {
  return { amount: '' }
}
