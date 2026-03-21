import { jsPDF } from 'jspdf'
import { convertFromUSD } from './exchangeRates'

// jsPDF's built-in helvetica only covers Latin-1; map non-ASCII symbols to safe ASCII equivalents
const PDF_SYMBOL_MAP = {
  USD: '$',   CAD: 'C$',  EUR: 'EUR', GBP: 'GBP', AUD: 'A$',  CHF: 'CHF',
  SAR: 'SR',  AED: 'AED', KWD: 'KD',  QAR: 'QR',  BHD: 'BD',  OMR: 'OMR',
  JOD: 'JD',  EGP: 'EGP', IQD: 'IQD', LYD: 'LD',  DZD: 'DA',  MAD: 'MAD',
  TND: 'DT',  SDG: 'SDG', PKR: 'PKR', BDT: 'BDT', INR: 'INR', MYR: 'RM',
  IDR: 'Rp',  AFN: 'AFN', TRY: 'TRY', IRR: 'IRR', NGN: 'NGN', KES: 'KSh',
  UZS: 'UZS', KZT: 'KZT', AZN: 'AZN', SGD: 'S$',  JPY: 'JPY', NZD: 'NZ$',
  HKD: 'HK$',
}

function getPdfSymbol(code) {
  return PDF_SYMBOL_MAP[code] || code
}

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatAmount(usdAmount, currency, exchangeRates, options = {}) {
  const { negative = false } = options
  const amount = currency && exchangeRates ? convertFromUSD(usdAmount, currency, exchangeRates) : usdAmount
  const sym = currency ? getPdfSymbol(currency) : '$'
  const formatted = fmt(Math.abs(amount))
  if (amount < 0 || (negative && amount > 0)) return `-${sym}${formatted}`
  return `${sym}${formatted}`
}

function drawAmount(doc, xRight, y, usdAmount, currency, exchangeRates, options = {}) {
  const { negative = false } = options
  const amount = currency && exchangeRates ? convertFromUSD(usdAmount, currency, exchangeRates) : usdAmount
  const sym = currency ? getPdfSymbol(currency) : '$'
  const numStr = fmt(Math.abs(amount))
  const prefix = amount < 0 || (negative && amount > 0) ? '-' : ''
  const symbolStr = prefix + sym

  const numW = doc.getTextWidth(numStr)
  const symW = doc.getTextWidth(symbolStr)
  const gap = 2

  doc.text(symbolStr, xRight - numW - gap - symW, y)
  doc.text(numStr, xRight, y, { align: 'right' })
}

const pageH = 297
const margin = 20

function checkPageBreak(doc, y, needed = 15) {
  if (y + needed > pageH - margin) {
    doc.addPage()
    return margin
  }
  return y
}

export function exportZakatReport(result, options = {}) {
  const doc = new jsPDF()

  const { currency = 'USD', exchangeRates = null } = options
  const { totalZakatableAssets, totalLiabilities, netZakatableWealth, nisab, zakatDue, meetsNisab, assetBreakdownDetailed, liabilityBreakdownDetailed, assetBreakdown, liabilityBreakdown } = result

  const amt = (usd) => formatAmount(usd, currency, exchangeRates)
  const assetSections = assetBreakdownDetailed?.length ? assetBreakdownDetailed : (assetBreakdown || []).filter((a) => a.value > 0).map((a) => ({ label: a.label, value: a.value, entries: [{ label: 'Total', value: a.value }] }))
  const liabilitySections = liabilityBreakdownDetailed?.length ? liabilityBreakdownDetailed : (liabilityBreakdown || []).filter((l) => l.value > 0).map((l) => ({ label: l.label, value: l.value, entries: [{ label: 'Total', value: l.value }] }))

  const pageW = doc.internal.pageSize.getWidth()
  const xRight = pageW - margin
  const draw = (yPos, usd, neg = false) => drawAmount(doc, xRight, yPos, usd, currency, exchangeRates, { negative: neg })
  let y = 20

  doc.setFontSize(22)
  doc.setTextColor(15, 45, 38)
  doc.text('FIKR Zakat Calculator', pageW / 2, y, { align: 'center' })
  y += 10

  doc.setFontSize(11)
  doc.setTextColor(92, 92, 92)
  doc.text('Report generated ' + new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), pageW / 2, y, { align: 'center' })
  y += 16

  doc.setDrawColor(201, 162, 39)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 14

  doc.setFontSize(12)
  doc.setTextColor(92, 92, 92)
  doc.text('ZAKAT DUE', margin, y)
  y += 8

  doc.setFontSize(28)
  doc.setTextColor(15, 45, 38)
  doc.text(amt(zakatDue), margin, y)
  y += 18

  doc.setFontSize(11)
  doc.setTextColor(92, 92, 92)
  doc.text('Calculation breakdown', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text('ASSETS', margin, y)
  y += 8

  for (const section of assetSections) {
    y = checkPageBreak(doc, y, 8)
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)
    doc.text(section.label, margin + 4, y)
    doc.setTextColor(26, 26, 26)
    draw(y, section.value)
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 6)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + entry.label, margin + 8, y)
      doc.setTextColor(60, 60, 60)
      draw(y, entry.value)
      y += 5

      for (const step of entry.steps || []) {
        y = checkPageBreak(doc, y, 5)
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text('    ' + step.desc, margin + 12, y)
        doc.setTextColor(80, 80, 80)
        draw(y, step.value, step.value < 0)
        y += 4
      }
    }
    y += 2
  }

  y = checkPageBreak(doc, y, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Total zakatable assets', margin + 4, y)
  draw(y, totalZakatableAssets)
  doc.setFont('helvetica', 'normal')
  y += 12

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text('LIABILITIES', margin, y)
  y += 8

  for (const section of liabilitySections) {
    y = checkPageBreak(doc, y, 8)
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)
    doc.text(section.label, margin + 4, y)
    doc.setTextColor(26, 26, 26)
    draw(y, section.value, true)
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 5)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + entry.label, margin + 8, y)
      doc.setTextColor(60, 60, 60)
      draw(y, entry.value, true)
      y += 5
    }
    y += 2
  }

  y = checkPageBreak(doc, y, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Total liabilities', margin + 4, y)
  draw(y, totalLiabilities, true)
  doc.setFont('helvetica', 'normal')
  y += 14

  y = checkPageBreak(doc, y, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 45, 38)
  doc.text('Net zakatable wealth', margin, y)
  draw(y, netZakatableWealth)
  doc.setFont('helvetica', 'normal')
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(92, 92, 92)
  doc.text('Nisab threshold', margin, y)
  doc.setTextColor(26, 26, 26)
  draw(y, nisab)
  y += 8

  doc.text('Zakat rate', margin, y)
  doc.text('2.5%', pageW - margin, y, { align: 'right' })
  y += 10

  if (!meetsNisab && netZakatableWealth > 0) {
    doc.setFontSize(9)
    doc.setTextColor(92, 92, 92)
    doc.text('Wealth below nisab. No zakat due this year.', margin, y)
    y += 10
  }

  y = checkPageBreak(doc, y, 25)
  y += 8
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text('Calculations follow the Hanafi school of thought. This calculator is a guide only. Consult a qualified scholar for your specific situation.', margin, y, { maxWidth: pageW - 2 * margin })
  y += 10
  doc.text('Zakat guide by Foundation for Inquiry, Knowledge and Revival', margin, y)

  doc.save('fikr-zakat-report.pdf')
}
