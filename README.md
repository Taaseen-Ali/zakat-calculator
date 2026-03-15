# FIKR Zakat Calculator

A modern Zakat calculator branded for [FIKR](https://fikr.us/) (Foundation for Inquiry, Knowledge, and Revival). Calculations follow the **Hanafi** school of thought, with rulings from the Fiqh Council of North America and SeekersGuidance.

## Features

- **Nisab**: Gold (87.48g) or Silver (612.36g) standard
- **Personal assets**: Precious metals (with live gold/silver price import), cash, cryptocurrency, short-term and long-term stocks, 401(k)/IRA (Method 1: withdrawal − penalty − taxes; Method 2: per-fund zakatable %)
- **Real estate & business**: Flipping properties, rental account balances, business assets (cash + inventory + receivables − liabilities), money lent (strong debt)
- **Deductions**: Credit cards, mortgage next principal, personal loans, unpaid taxes, unpaid zakat, other liabilities
- **Result**: Total zakatable assets, net wealth, nisab threshold, and **Zakat due at 2.5%**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

The app is configured for GitHub Pages. After pushing to `main`:

1. Go to **Settings → Pages** in the repo
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. The workflow will build and deploy on each push to `main`

Live site: **https://taaseen-ali.github.io/zakat-calculator/**

## Tech

- React 18 + Vite
- No backend; all state in React (with optional `localStorage` persistence)
- Mobile-friendly layout with safe-area support

## Disclaimer

This calculator is a guide only. Consult a qualified scholar for your specific situation.
