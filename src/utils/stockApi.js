const TICKER_SEARCH = 'https://ticker-2e1ica8b9.now.sh/keyword'

export async function searchTickers(query) {
  if (!query || query.length < 2) return []
  try {
    const url = `${TICKER_SEARCH}/${encodeURIComponent(query.trim())}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.slice(0, 10) : []
  } catch {
    return []
  }
}
