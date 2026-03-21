/**
 * Exchange rates via open.er-api.com — free, no API key required.
 * Falls back to Frankfurter for any missing rates.
 * https://www.exchangerate-api.com/docs/free
 */

const ER_API_BASE = 'https://open.er-api.com/v6/latest/USD'
const FRANKFURTER_BASE = 'https://api.frankfurter.app'

export const CURRENCIES = [
  // Major / Western
  { code: 'USD', name: 'US Dollar',            symbol: '$',   flag: '🇺🇸' },
  { code: 'CAD', name: 'Canadian Dollar',       symbol: 'C$',  flag: '🇨🇦' },
  { code: 'EUR', name: 'Euro',                  symbol: '€',   flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',         symbol: '£',   flag: '🇬🇧' },
  { code: 'AUD', name: 'Australian Dollar',     symbol: 'A$',  flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc',           symbol: 'CHF', flag: '🇨🇭' },
  // Arab / Middle East
  { code: 'SAR', name: 'Saudi Riyal',           symbol: 'SR',  flag: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham',            symbol: 'AED', flag: '🇦🇪' },
  { code: 'KWD', name: 'Kuwaiti Dinar',         symbol: 'KD',  flag: '🇰🇼' },
  { code: 'QAR', name: 'Qatari Riyal',          symbol: 'QR',  flag: '🇶🇦' },
  { code: 'BHD', name: 'Bahraini Dinar',        symbol: 'BD',  flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial',            symbol: 'OMR', flag: '🇴🇲' },
  { code: 'JOD', name: 'Jordanian Dinar',       symbol: 'JD',  flag: '🇯🇴' },
  { code: 'EGP', name: 'Egyptian Pound',        symbol: 'E£',  flag: '🇪🇬' },
  { code: 'IQD', name: 'Iraqi Dinar',           symbol: 'IQD', flag: '🇮🇶' },
  { code: 'LYD', name: 'Libyan Dinar',          symbol: 'LD',  flag: '🇱🇾' },
  { code: 'DZD', name: 'Algerian Dinar',        symbol: 'DA',  flag: '🇩🇿' },
  { code: 'MAD', name: 'Moroccan Dirham',       symbol: 'MAD', flag: '🇲🇦' },
  { code: 'TND', name: 'Tunisian Dinar',        symbol: 'DT',  flag: '🇹🇳' },
  { code: 'SDG', name: 'Sudanese Pound',        symbol: 'SDG', flag: '🇸🇩' },
  // South / Southeast Asia
  { code: 'PKR', name: 'Pakistani Rupee',       symbol: '₨',   flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka',      symbol: '৳',   flag: '🇧🇩' },
  { code: 'INR', name: 'Indian Rupee',          symbol: '₹',   flag: '🇮🇳' },
  { code: 'MYR', name: 'Malaysian Ringgit',     symbol: 'RM',  flag: '🇲🇾' },
  { code: 'IDR', name: 'Indonesian Rupiah',     symbol: 'Rp',  flag: '🇮🇩' },
  { code: 'AFN', name: 'Afghan Afghani',        symbol: '؋',   flag: '🇦🇫' },
  // Other Muslim-majority
  { code: 'TRY', name: 'Turkish Lira',          symbol: '₺',   flag: '🇹🇷' },
  { code: 'IRR', name: 'Iranian Rial',          symbol: '﷼',   flag: '🇮🇷' },
  { code: 'NGN', name: 'Nigerian Naira',        symbol: '₦',   flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling',       symbol: 'KSh', flag: '🇰🇪' },
  { code: 'UZS', name: 'Uzbekistani Som',       symbol: 'сўм', flag: '🇺🇿' },
  { code: 'KZT', name: 'Kazakhstani Tenge',     symbol: '₸',   flag: '🇰🇿' },
  { code: 'AZN', name: 'Azerbaijani Manat',     symbol: '₼',   flag: '🇦🇿' },
  { code: 'SGD', name: 'Singapore Dollar',      symbol: 'S$',  flag: '🇸🇬' },
]

const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]))

let cachedRates = null
let cachedAt = 0
const CACHE_MS = 60 * 60 * 1000 // 1 hour

export async function fetchExchangeRates(forceRefresh = false) {
  if (!forceRefresh && cachedRates && Date.now() - cachedAt < CACHE_MS) {
    return cachedRates
  }
  try {
    const res = await fetch(ER_API_BASE)
    if (!res.ok) throw new Error('ER API failed')
    const data = await res.json()
    if (data.result !== 'success') throw new Error('ER API error')
    cachedRates = { USD: 1, ...data.rates }
    cachedAt = Date.now()
    return cachedRates
  } catch (_) {
    // Fallback: Frankfurter (covers most major currencies)
    try {
      const res = await fetch(`${FRANKFURTER_BASE}/latest?from=USD`)
      if (!res.ok) throw new Error('Frankfurter failed')
      const data = await res.json()
      cachedRates = { USD: 1, ...data.rates }
      cachedAt = Date.now()
      return cachedRates
    } catch (__) {
      return cachedRates || { USD: 1 }
    }
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
