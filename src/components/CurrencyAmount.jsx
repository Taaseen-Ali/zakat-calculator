import { convertFromUSD, getCurrencySymbol, formatCurrency } from '../utils/exchangeRates'

/**
 * Renders a currency amount with symbol and number in separate spans.
 * @param signed - when true, show − prefix if amount is negative
 * @param negative - when true, always show − prefix (e.g. for liabilities)
 * @param compact - when true, no padding between symbol and number (e.g. for "Gold $65/g")
 */
export function CurrencyAmount({ usdAmount, dec = 2, signed = false, negative = false, compact = false, currency, exchangeRates, hideSensitiveNumbers, className = '' }) {
  if (hideSensitiveNumbers) {
    return <span className={className}>XXX</span>
  }
  const curr = exchangeRates && exchangeRates[currency] ? currency : 'USD'
  const n = usdAmount ?? 0
  const isNeg = negative || (signed && n < 0)
  const absAmount = Math.abs(n)
  const conv = convertFromUSD(absAmount, curr, exchangeRates || { USD: 1 })
  const sym = getCurrencySymbol(curr)
  const num = formatCurrency(conv, curr, dec)

  return (
    <span className={`currency-amount ${compact ? 'currency-amount--compact' : ''} ${className}`.trim()}>
      {isNeg && <span className="currency-minus">−</span>}
      <span className="currency-symbol">{sym}</span>
      <span className="currency-number">{num}</span>
    </span>
  )
}
