import { useState, useEffect, useRef } from 'react'
import { fetchTopCoins, fetchCryptoPrices } from '../utils/cryptoApi'

export function CryptoAutocomplete({ value, onChange, onCoinSelect, placeholder = 'e.g. Bitcoin' }) {
  const [query, setQuery] = useState(value || '')
  const [coins, setCoins] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    setLoading(true)
    fetchTopCoins().then((data) => {
      setCoins(data || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(coins.slice(0, 12))
      return
    }
    const q = query.trim().toLowerCase()
    const matches = coins.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q)
    )
    setFiltered(matches.slice(0, 12))
  }, [query, coins])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(coin) {
    setQuery(coin.name)
    onChange(coin.name)
    onCoinSelect({ id: coin.id, name: coin.name, symbol: coin.symbol, price: coin.price })
    setOpen(false)
  }

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <input
        type="text"
        className="input autocomplete-input"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(e.target.value) }}
        onFocus={() => { setOpen(true); if (filtered.length === 0 && coins.length > 0) setFiltered(coins.slice(0, 12)) }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {loading ? (
            <li className="autocomplete-item autocomplete-loading">Loading…</li>
          ) : filtered.length === 0 ? (
            <li className="autocomplete-item autocomplete-empty">No matches</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id} className="autocomplete-item" onClick={() => handleSelect(c)}>
                <span className="autocomplete-item-symbol">{c.symbol}</span>
                <span className="autocomplete-item-name">{c.name}</span>
                {c.price != null && (
                  <span className="autocomplete-item-price">${c.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
