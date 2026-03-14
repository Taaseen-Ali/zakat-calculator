import { jsPDF } from 'jspdf'

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  doc.text('$' + fmt(zakatDue), margin, y)
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
    doc.text('$' + fmt(section.value), pageW - margin, y, { align: 'right' })
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 6)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + entry.label, margin + 8, y)
      doc.setTextColor(60, 60, 60)
      doc.text('$' + fmt(entry.value), pageW - margin, y, { align: 'right' })
      y += 5

      for (const step of entry.steps || []) {
        y = checkPageBreak(doc, y, 5)
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text('    ' + step.desc, margin + 12, y)
        doc.setTextColor(80, 80, 80)
        const stepVal = step.value >= 0 ? '$' + fmt(step.value) : '−$' + fmt(Math.abs(step.value))
        doc.text(stepVal, pageW - margin, y, { align: 'right' })
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
  doc.text('$' + fmt(totalZakatableAssets), pageW - margin, y, { align: 'right' })
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
    doc.text('−$' + fmt(section.value), pageW - margin, y, { align: 'right' })
    y += 6

    for (const entry of section.entries || []) {
      y = checkPageBreak(doc, y, 5)
      doc.setFontSize(9)
      doc.setTextColor(92, 92, 92)
      doc.text('  ' + entry.label, margin + 8, y)
      doc.setTextColor(60, 60, 60)
      doc.text('−$' + fmt(entry.value), pageW - margin, y, { align: 'right' })
      y += 5
    }
    y += 2
  }

  y = checkPageBreak(doc, y, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Total liabilities', margin + 4, y)
  doc.text('−$' + fmt(totalLiabilities), pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 14

  y = checkPageBreak(doc, y, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 45, 38)
  doc.text('Net zakatable wealth', margin, y)
  doc.text('$' + fmt(netZakatableWealth), pageW - margin, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 8

  doc.setFontSize(10)
  doc.setTextColor(92, 92, 92)
  doc.text('Nisab threshold', margin, y)
  doc.setTextColor(26, 26, 26)
  doc.text('$' + fmt(nisab), pageW - margin, y, { align: 'right' })
  y += 8

  doc.text('Zakat rate', margin, y)
  doc.text('2.5%', pageW - margin, y, { align: 'right' })
  y += 10

  if (!meetsNisab && netZakatableWealth > 0) {
    doc.setFontSize(9)
    doc.setTextColor(92, 92, 92)
    doc.text('Wealth below nisab — no zakat due this year.', margin, y)
    y += 10
  }

  y = checkPageBreak(doc, y, 25)
  y += 8
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text('Calculations follow the Hanafi school of thought. This calculator is a guide only — consult a qualified scholar for your specific situation.', margin, y, { maxWidth: pageW - 2 * margin })
  y += 10
  doc.text('Zakat guide by Foundation for Inquiry, Knowledge and Revival', margin, y)

  doc.save('fikr-zakat-report.pdf')
}
