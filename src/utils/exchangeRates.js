/**
 * Exchange rates via Frankfurter API — free, no API key required.
 * https://frankfurter.dev/
 */

const API_BASE = 'https://api.frankfurter.app'

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
]

const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]))

const FRANKFURTER_CURRENCIES = ['CAD', 'EUR', 'GBP', 'AUD', 'CHF', 'JPY', 'SGD', 'INR', 'NZD', 'HKD', 'MYR']

let cachedRates = null
let cachedAt = 0
const CACHE_MS = 60 * 60 * 1000 // 1 hour

export async function fetchExchangeRates(forceRefresh = false) {
  if (!forceRefresh && cachedRates && Date.now() - cachedAt < CACHE_MS) {
    return cachedRates
  }
  try {
    const to = FRANKFURTER_CURRENCIES.filter((c) => c !== 'USD').join(',')
    const res = await fetch(`${API_BASE}/latest?from=USD&to=${to}`)
    if (!res.ok) throw new Error('Exchange rate request failed')
    const data = await res.json()
    const rates = { USD: 1, ...data.rates }
    cachedRates = rates
    cachedAt = Date.now()
    return rates
  } catch (_) {
    return { USD: 1 }
  }
}

export function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code + ' '
}

/** Padded to 2 chars for consistent alignment in columns */
export function getCurrencySymbolPadded(code) {
  const sym = getCurrencySymbol(code)
  return sym.length >= 2 ? sym : sym.padEnd(2, '\u00A0')
}

export function convertFromUSD(amountUsd, toCurrency, rates) {
  if (toCurrency === 'USD' || !rates) return amountUsd
  const rate = rates[toCurrency]
  if (!rate) return amountUsd
  return amountUsd * rate
}

export function convertToUSD(amountInCurrency, fromCurrency, rates) {
  if (fromCurrency === 'USD' || !rates) return amountInCurrency
  const rate = rates[fromCurrency]
  if (!rate) return amountInCurrency
  return amountInCurrency / rate
}

export function formatCurrency(amount, currency, decimals = 2) {
  const dec = decimals
  return (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}
