export const ASSET_TYPES = [
  { id: 'cash', label: 'Cash & savings', icon: '💵', desc: 'Bank accounts, checking, savings', tooltip: 'Full balance is zakatable. Formula: Balance × 2.5%. Include all cash in bank accounts, checking, savings, and money at home.' },
  { id: 'gold_silver', label: 'Gold & silver', icon: '🥇', desc: 'Precious metals you own', tooltip: 'Value = grams × price per gram. Full value is zakatable at 2.5%. Use current market prices (loaded above) on your zakat due date.' },
  { id: 'crypto', label: 'Cryptocurrency', icon: '₿', desc: 'Bitcoin, Ethereum, etc.', tooltip: 'Crypto is a commodity, not currency. Only zakatable if held for trading (bought to sell). Long-term holdings are excluded from zakat.' },
  { id: 'stocks_short', label: 'Stocks (trading)', icon: '📈', desc: 'Held under 1 year', tooltip: 'Held less than 1 year or actively traded for profit. Full market value is zakatable at 2.5%.' },
  { id: 'stocks_long', label: 'Stocks (long-term)', icon: '🌱', desc: 'Held over 1 year', tooltip: 'Held over 1 year with no near-term plan to sell. Zakat on zakatable assets per share (balance sheet data). Default 30% if unknown.' },
  { id: 'retirement', label: '401(k) / IRA', icon: '🏛️', desc: 'Retirement accounts', tooltip: 'Method 1: Zakat on what you\'d receive if withdrawn today (after 10% penalty and taxes). Method 2: Per-fund zakatable assets. Per Fiqh Council of North America.' },
  { id: 'real_estate', label: 'Real estate (flipping)', icon: '🏚️', desc: 'Properties to sell', tooltip: 'Properties bought with intent to resell are trade goods. Full current market value × 2.5%. Only if you own with firm intention to sell on zakat date.' },
  { id: 'rental', label: 'Rental income', icon: '🏠', desc: 'Net rental cash', tooltip: 'In Hanafi school, zakat is on net rental cash you hold — not the property. Enter your rental account balance (rent minus expenses) on zakat date.' },
  { id: 'business', label: 'Business assets', icon: '📊', desc: 'Cash, inventory, receivables', tooltip: 'Zakatable = cash + inventory + receivables − business debts. Fixed assets (equipment, property) are NOT zakatable. Your ownership % applies if partial owner.' },
  { id: 'money_lent', label: 'Money lent', icon: '🤝', desc: 'Loans you\'ve given (strong debt)', tooltip: 'Money lent is still your wealth. Strong debt (borrower acknowledges and can repay) is zakatable annually. Weak debt is excluded until received.' }
]

export const ASSET_GROUPS = [
  { label: 'Cash & equivalents', ids: ['cash', 'gold_silver', 'crypto'] },
  { label: 'Investments', ids: ['stocks_short', 'stocks_long', 'retirement'] },
  { label: 'Property', ids: ['real_estate', 'rental'] },
  { label: 'Other', ids: ['business', 'money_lent'] }
]

export const LIABILITY_TYPES = [
  { id: 'credit_card', label: 'Credit card', icon: '💳', tooltip: 'Total outstanding balance across all cards. Deducted from zakatable wealth before 2.5% is applied.' },
  { id: 'mortgage', label: 'Mortgage (next principal)', icon: '🏡', tooltip: 'Principal portion of your next single payment only — exclude interest. Found on your mortgage statement.' },
  { id: 'personal_loan', label: 'Personal loan', icon: '📋', tooltip: 'Car loans, student loans, or any installment due within the next 12 months.' },
  { id: 'money_owed', label: 'Money owed', icon: '👤', tooltip: 'Informal debts you are obligated to repay to family or friends.' },
  { id: 'unpaid_taxes', label: 'Unpaid taxes & bills', icon: '📄', tooltip: 'Tax bills, utility arrears, or any other currently-due obligations.' },
  { id: 'unpaid_zakat', label: 'Unpaid zakat (prior years)', icon: '🤲', tooltip: 'If you missed zakat in prior years, that amount is a debt owed and is deducted from this year\'s zakatable wealth.' },
  { id: 'other', label: 'Other debt', icon: '📌', tooltip: 'Any other personal debt currently due that doesn\'t fit the categories above.' }
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
    case 'retirement': return { method: 'method1', balance: '', useTaxableIncome: true, taxableIncome: '', grossIncome: '', filingStatus: 'Single', stateName: 'New York', funds: [] }
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
