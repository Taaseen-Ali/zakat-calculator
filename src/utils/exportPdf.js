import { jsPDF } from 'jspdf'

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// jsPDF's default font doesn't support Unicode; replace with ASCII to avoid garbled/monospace output
function sanitize(str) {
  if (str == null || typeof str !== 'string') return ''
  return str
    .replace(/\u2212/g, '-')   // − (minus sign) → -
    .replace(/\u00D7/g, 'x')  // × (multiplication) → x
    .replace(/[\u2018\u2019]/g, "'")  // smart quotes → straight apostrophe
    .replace(/[\u201C\u201D]/g, '"')  // smart double quotes → straight
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
  const { totalZakatableAssets, totalLiabilities, netZakatableWealth, nisab, zakatDue, meetsNisab, assetBreakdownDetailed, liabilityBreakdownDetailed, assetBreakdown, liabilityBreakdown } = result

  const assetSections = assetBreakdownDetailed?.length ? assetBreakdownDetailed : (assetBreakdown || []).filter((a) => a.value > 0).map((a) => ({ label: a.label, value: a.value, entries: [{ label: 'Total', value: a.value }] }))
  const liabilitySections = liabilityBreakdownDetailed?.length ? liabilityBreakdownDetailed : (liabilityBreakdown || []).filter((l) => l.value > 0).map((l) => ({ label: l.label, value: l.value, entries: [{ label: 'Total', value: l.value }] }))

  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFontSize(22)
  doc.setTextColor(15, 45, 38)
  doc.text(sanitize('FIKR Zakat Calculator'), pageW / 2, y, { align: 'center' })
  y += 10

  doc.setFontSize(11)
  doc.setTextColor(92, 92, 92)
  doc.text(sanitize('Report generated ' + new Date().toLocaleDateString('en-US', { dateStyle: 'long' })), pageW / 2, y, { align: 'center' })
  y += 16

  doc.setDrawColor(201, 162, 39)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 14

  doc.setFontSize(12)
  doc.setTextColor(92, 92, 92)
  doc.text(sanitize('ZAKAT DUE'), margin, y)
  y += 8

  doc.setFontSize(28)
  doc.setTextColor(15, 45, 38)
  doc.text(sanitize('$' + fmt(zakatDue)), margin, y)
  y += 18

  doc.setFontSize(11)
  doc.setTextColor(92, 92, 92)
  doc.text(sanitize('Calculation breakdown'), margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(sanitize('ASSETS'), margin, y)
  y += 8

  for (const section of assetSections) {
    y = checkPageBreak(doc, y, 8)
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)
    doc.text(sanitize(section.label), margin + 4, y)
    doc.setTextColor(26, 26, 26)
    doc.text(sanitize('$' + fmt(section.value)), pageW - margin, y, { align: 'right' })
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 6)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + sanitize(entry.label), margin + 8, y)
      doc.setTextColor(60, 60, 60)
      doc.text(sanitize('$' + fmt(entry.value)), pageW - margin, y, { align: 'right' })
      y += 5

      for (const step of entry.steps || []) {
        y = checkPageBreak(doc, y, 5)
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text('    ' + sanitize(step.desc), margin + 12, y)
        doc.setTextColor(80, 80, 80)
        const stepVal = step.value >= 0 ? '$' + fmt(step.value) : '-$' + fmt(Math.abs(step.value))
        doc.text(sanitize(stepVal), pageW - margin, y, { align: 'right' })
        y += 4
      }
    }
    y += 2
  }

  y = checkPageBreak(doc, y, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text(sanitize('Total zakatable assets'), margin + 4, y)
  doc.text(sanitize('$' + fmt(totalZakatableAssets)), pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 12

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(sanitize('LIABILITIES'), margin, y)
  y += 8

  for (const section of liabilitySections) {
    y = checkPageBreak(doc, y, 8)
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)
    doc.text(sanitize(section.label), margin + 4, y)
    doc.setTextColor(26, 26, 26)
    doc.text(sanitize('-$' + fmt(section.value)), pageW - margin, y, { align: 'right' })
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 5)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + sanitize(entry.label), margin + 8, y)
      doc.setTextColor(60, 60, 60)
      doc.text(sanitize('-$' + fmt(entry.value)), pageW - margin, y, { align: 'right' })
      y += 5
    }
    y += 2
  }

  y = checkPageBreak(doc, y, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text(sanitize('Total liabilities'), margin + 4, y)
  doc.text(sanitize('-$' + fmt(totalLiabilities)), pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 14

  y = checkPageBreak(doc, y, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 45, 38)
  doc.text(sanitize('Net zakatable wealth'), margin, y)
  doc.text(sanitize('$' + fmt(netZakatableWealth)), pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(92, 92, 92)
  doc.text(sanitize('Nisab threshold'), margin, y)
  doc.setTextColor(26, 26, 26)
  doc.text(sanitize('$' + fmt(nisab)), pageW - margin, y, { align: 'right' })
  y += 8

  doc.text(sanitize('Zakat rate'), margin, y)
  doc.text(sanitize('2.5%'), pageW - margin, y, { align: 'right' })
  y += 10

  if (!meetsNisab && netZakatableWealth > 0) {
    doc.setFontSize(9)
    doc.setTextColor(92, 92, 92)
    doc.text(sanitize('Wealth below nisab. No zakat due this year.'), margin, y)
    y += 10
  }

  y = checkPageBreak(doc, y, 25)
  y += 8
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(sanitize('Calculations follow the Hanafi school of thought. This calculator is a guide only. Consult a qualified scholar for your specific situation.'), margin, y, { maxWidth: pageW - 2 * margin })
  y += 10
  doc.text(sanitize('Zakat guide by Foundation for Inquiry, Knowledge and Revival'), margin, y)

  doc.save('fikr-zakat-report.pdf')
}
