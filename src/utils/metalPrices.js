const OZ_TO_GRAM = 31.1035
const FALLBACK_GOLD = 75
const FALLBACK_SILVER = 1.05
const METALS_API = 'https://api.metals.live/v1/spot'

export async function fetchMetalPrices() {
  try {
    const res = await fetch(METALS_API)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Invalid response')
    const gold = data.find((x) => x.metal === 'gold' && x.currency === 'USD')
    const silver = data.find((x) => x.metal === 'silver' && x.currency === 'USD')
    const goldVal = gold?.price ? parseFloat((gold.price / OZ_TO_GRAM).toFixed(2)) : null
    const silverVal = silver?.price ? parseFloat((silver.price / OZ_TO_GRAM).toFixed(2)) : null
    return {
      gold: goldVal ?? FALLBACK_GOLD,
      silver: silverVal ?? FALLBACK_SILVER,
      source: goldVal != null ? 'live' : 'approx'
    }
  } catch (_) {
    return {
      gold: FALLBACK_GOLD,
      silver: FALLBACK_SILVER,
      source: 'approx'
    }
  }
}
