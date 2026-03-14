import { useState, useEffect, useRef } from 'react'
import { searchTickers } from '../utils/stockApi'

export function TickerAutocomplete({ value, onChange, placeholder = 'e.g. AAPL' }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setLoading(true)
    searchTickers(query).then((data) => {
      if (!cancelled) {
        setSuggestions(data || [])
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(item) {
    const ticker = item.symbol || item
    setQuery(ticker)
    onChange(ticker)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <div className="autocomplete-input-row">
        <input
          type="text"
          className="input autocomplete-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(e.target.value) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s) => (
            <li key={s.symbol} className="autocomplete-item" onClick={() => handleSelect(s)}>
              <span className="autocomplete-item-symbol">{s.symbol}</span>
              <span className="autocomplete-item-name">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
