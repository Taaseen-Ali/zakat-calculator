/**
 * FIKR site header — matches fikr.us layout, colors, and structure.
 * Top bar (desktop): Tel, Email | Study quick links
 * Main header: Logo, Nav, Search (desktop) | Logo, Burger (mobile)
 */
import { useState, useEffect, useRef } from 'react'

const FIKR_LOGO = 'https://fikr.us/wp-content/uploads/2025/01/Foundation-for-Inquiry-Knowledge-and-Revival-1-2.png'

const TOP_BAR_STUDY = [
  { label: 'Islamic Sciences', href: 'https://fikr.us/isp/' },
  { label: 'ʿĀlimiyyah', href: 'https://fikr.us/alimiyyah/' },
  { label: 'Postgraduate', href: '#' },
]

const FIKR_NAV = [
  { label: 'Home', href: 'https://fikr.us' },
  { label: 'About', href: 'https://fikr.us/about-2/' },
  { label: 'Study', href: 'https://fikr.us/all-programs/' },
  { label: 'People', href: 'https://fikr.us/faculty/' },
  { label: 'Research', href: 'https://fikr.us/research/' },
  { label: 'Contact', href: 'https://fikr.us/contact/' },
  { label: 'Support Us', href: 'https://fikr.us/support-us/' },
  { label: 'Zakat Calculator', href: '#', isCurrent: true },
]

export function FikrSiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const headerRef = useRef(null)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const setHeight = () => {
      document.documentElement.style.setProperty('--fikr-header-height', `${el.offsetHeight}px`)
    }
    setHeight()
    const ro = new ResizeObserver(setHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header className="fikr-site-header" ref={headerRef} dir="ltr">
      {/* Top bar — hidden on mobile */}
      <div className="fikr-top-bar">
        <div className="fikr-top-bar-inner">
          <div className="fikr-top-bar-left">
            <span className="fikr-top-bar-item">Tel: (+1) 347-975-2489</span>
            <span className="fikr-top-bar-sep" aria-hidden />
            <span className="fikr-top-bar-item">
              Email: <a href="mailto:info@fikr.us">info@fikr.us</a>
            </span>
          </div>
          <div className="fikr-top-bar-right">
            {TOP_BAR_STUDY.map((item) => (
              <a key={item.label} href={item.href} className="fikr-top-bar-link">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="fikr-main-header">
        <div className="fikr-main-header-inner">
          <div className="fikr-main-header-left">
            <a href="https://fikr.us" className="fikr-logo-link" aria-label="FIKR Home">
              <img src={FIKR_LOGO} alt="FIKR | Foundation for Inquiry, Knowledge, and Revival" className="fikr-logo" />
            </a>
            <nav className="fikr-nav-desktop" aria-label="Main navigation">
              {FIKR_NAV.map((item) =>
                item.isCurrent ? (
                  <span key={item.label} className="fikr-nav-link fikr-nav-link--current" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <a key={item.label} href={item.href} className="fikr-nav-link" target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                )
              )}
            </nav>
            <button
              type="button"
              className="fikr-search-toggle"
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              aria-expanded={searchOpen}
            >
              <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden>
                <path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="fikr-menu-toggle"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="fikr-menu-icon-open" viewBox="0 0 1000 1000" fill="currentColor" aria-hidden>
              <path d="M104 333H896C929 333 958 304 958 271S929 208 896 208H104C71 208 42 237 42 271S71 333 104 333ZM104 583H896C929 583 958 554 958 521S929 458 896 458H104C71 458 42 487 42 521S71 583 104 583ZM104 833H896C929 833 958 804 958 771S929 708 896 708H104C71 708 42 737 42 771S71 833 104 833Z" />
            </svg>
            <svg className="fikr-menu-icon-close" viewBox="0 0 1000 1000" fill="currentColor" aria-hidden>
              <path d="M742 167L500 408 258 167C246 154 233 150 217 150 196 150 179 158 167 167 154 179 150 196 150 212 150 229 154 242 171 254L408 500 167 742C138 771 138 800 167 829 196 858 225 858 254 829L496 587 738 829C750 842 767 846 783 846 800 846 817 842 829 829 842 817 846 804 846 783 846 767 842 750 829 737L588 500 833 258C863 229 863 200 833 171 804 137 775 137 742 167Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`fikr-mobile-menu ${mobileMenuOpen ? 'fikr-mobile-menu--open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <nav className="fikr-mobile-nav" aria-label="Mobile menu">
          {FIKR_NAV.map((item) =>
            item.isCurrent ? (
              <span key={item.label} className="fikr-mobile-nav-link fikr-mobile-nav-link--current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="fikr-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            )
          )}
        </nav>
      </div>

      {/* Full-screen search overlay */}
      {searchOpen && (
        <div className="fikr-search-overlay" role="dialog" aria-label="Search">
          <form
            className="fikr-search-form"
            action="https://fikr.us"
            method="get"
            onSubmit={() => setSearchOpen(false)}
          >
            <input
              type="search"
              name="s"
              placeholder="Search..."
              className="fikr-search-input"
              autoFocus
              autoComplete="off"
            />
            <button type="button" className="fikr-search-close" onClick={() => setSearchOpen(false)} aria-label="Close search">
              <svg viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M742 167L500 408 258 167C246 154 233 150 217 150 196 150 179 158 167 167 154 179 150 196 150 212 150 229 154 242 171 254L408 500 167 742C138 771 138 800 167 829 196 858 225 858 254 829L496 587 738 829C750 842 767 846 783 846 800 846 817 842 829 829 842 817 846 804 846 783 846 767 842 750 829 737L588 500 833 258C863 229 863 200 833 171 804 137 775 137 742 167Z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </header>
  )
}
