const OZ_TO_GRAM = 31.1035

// Gold-API.com — free, no auth required. Returns price per troy ounce.
const GOLD_API = 'https://api.gold-api.com/price'

export async function fetchMetalPrices() {
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch(`${GOLD_API}/XAU`),
      fetch(`${GOLD_API}/XAG`)
    ])
    if (!goldRes.ok || !silverRes.ok) throw new Error('API request failed')
    const goldData = await goldRes.json()
    const silverData = await silverRes.json()
    const goldPerOz = goldData?.price
    const silverPerOz = silverData?.price
    const goldVal = goldPerOz != null ? parseFloat((goldPerOz / OZ_TO_GRAM).toFixed(2)) : null
    const silverVal = silverPerOz != null ? parseFloat((silverPerOz / OZ_TO_GRAM).toFixed(2)) : null
    return {
      gold: goldVal,
      silver: silverVal
    }
  } catch (_) {
    return { gold: null, silver: null }
  }
}
