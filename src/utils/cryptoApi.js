const COINS_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets'
const SIMPLE_PRICE = 'https://api.coingecko.com/api/v3/simple/price'

let cachedCoins = null
let cacheTime = 0
const CACHE_MS = 5 * 60 * 1000 // 5 min

/** Direct fetch. CoinGecko supports CORS for browser requests. */
function fetchUrl(url) {
  return fetch(url)
}

export async function fetchTopCoins() {
  if (cachedCoins && Date.now() - cacheTime < CACHE_MS) return cachedCoins
  try {
    const url = `${COINS_MARKETS}?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`
    const res = await fetchUrl(url)
    const data = await res.json()
    if (!Array.isArray(data)) return cachedCoins || []
    cachedCoins = data.map((c) => ({ id: c.id, symbol: c.symbol?.toUpperCase(), name: c.name, price: c.current_price }))
    cacheTime = Date.now()
    return cachedCoins
  } catch {
    return cachedCoins || []
  }
}

export function clearCryptoCache() {
  cachedCoins = null
  cacheTime = 0
}

export async function fetchCryptoPrices(ids) {
  if (!ids?.length) return {}
  try {
    const url = `${SIMPLE_PRICE}?ids=${ids.join(',')}&vs_currencies=usd`
    const res = await fetchUrl(url)
    const data = await res.json()
    const out = {}
    for (const id of ids) {
      const p = data?.[id]?.usd
      if (p != null) out[id] = Number(p)
    }
    return out
  } catch {
    return {}
  }
}
