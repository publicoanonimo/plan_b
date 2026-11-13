import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { money, totals, saleTime, registerSales, cashEntryTotal } from './domain.js';

const colors = {
  background: [11, 6, 20], card: [18, 11, 31], strip: [8, 4, 15],
  cyan: [0, 240, 255], pink: [255, 0, 160], emerald: [0, 229, 163],
  purple: [157, 78, 221], text: [248, 250, 252], muted: [189, 179, 207],
  line: [65, 39, 83], alternate: [23, 14, 36],
};
let fontPromise;
async function loadReportFont() {
  fontPromise ??= fetch('/fonts/Anton-Regular.ttf').then(async response => {
    if (!response.ok) throw new Error('No se pudo cargar la tipografía del reporte. Intenta de nuevo.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
    return btoa(binary);
  }).catch(error => { fontPromise = undefined; throw error; });
  return fontPromise;
}

export function createReport(sales, fontData) {
  sales = registerSales(sales);
  const pdf = new jsPDF({format: 'a4', unit: 'mm', putOnlyUsedFonts: true});
  const font = fontData ? 'Anton' : 'helvetica';
  if (fontData) {
    pdf.addFileToVFS('Anton-Regular.ttf', fontData);
    pdf.addFont('Anton-Regular.ttf', font, 'normal');
  }
  pdf.setFont(font, 'normal');
  pdf.setProperties({title: 'PLAN B · Reporte de caja', subject: 'Movimientos y totales de la caja actual', author: 'PLAN B'});
  const total = totals(sales);
  const issuedAt = new Date();
  const issuedLabel = `${issuedAt.toLocaleDateString('es-BO')} · ${issuedAt.toLocaleTimeString('es-BO', {hour12: false})}`;
  const setText = (color, size) => { pdf.setTextColor(...color); pdf.setFontSize(size); };
  const divider = y => {
    for (let i = 0; i < 182; i++) {
      const from = i < 91 ? colors.pink : colors.purple;
      const to = i < 91 ? colors.purple : colors.cyan;
      const progress = (i % 91) / 90;
      pdf.setFillColor(...from.map((channel, index) => Math.round(channel + (to[index] - channel) * progress)));
      pdf.rect(14 + i, y, 1, .5, 'F');
    }
  };
  const header = () => {
    pdf.setFillColor(...colors.strip);
    pdf.rect(0, 0, 210, 35, 'F');
    setText([255, 153, 216], 24);
    pdf.text('PLAN B', 24, 19);
    // Vector wings preserve the current brand without unsupported font glyphs.
    pdf.setDrawColor(...colors.pink);
    pdf.setLineWidth(.35);
    pdf.lines([[-4, -3], [1, 7], [4, 3], [-1, -7]], 20, 13);
    const end = 24 + pdf.getTextWidth('PLAN B') + 4;
    pdf.lines([[4, -3], [-1, 7], [-4, 3], [1, -7]], end, 13);
    setText(colors.muted, 9);
    pdf.text('REPORTE DE CAJA', 196, 16, {align: 'right'});
    pdf.text(issuedLabel, 196, 24, {align: 'right'});
    divider(34.5);
  };
  const page = () => {
    pdf.setFillColor(...colors.background);
    pdf.rect(0, 0, 210, 297, 'F');
    header();
  };
  page();
  setText(colors.cyan, 16);
  pdf.text('RESUMEN DE CAJA', 14, 48);
  setText(colors.muted, 9);
  pdf.text(`${sales.length} movimientos`, 196, 48, {align: 'right'});
  [
    ['CAJA', cashEntryTotal(sales), colors.cyan],
    ['TOTAL QR', total.qr, colors.pink],
    ['TOTAL EFECTIVO', total.cash, colors.emerald],
    ['TOTAL DE CAJA', total.total, colors.purple],
  ].forEach(([label, amount, accent], i) => {
    const width = 42.5;
    const x = 14 + i * (width + 4);
    pdf.setFillColor(...colors.card);
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(.25);
    pdf.roundedRect(x, 55, width, 34, 2.5, 2.5, 'FD');
    pdf.setFillColor(...accent);
    pdf.roundedRect(x + 5, 54.8, 12, 1, .3, .3, 'F');
    pdf.setFillColor(...colors.strip);
    pdf.roundedRect(x + 3, 60, width - 6, 9, 1.5, 1.5, 'F');
    setText(accent, 9);
    pdf.text(label, x + 6, 66);
    const value = `Bs ${money(amount)}`;
    setText(colors.text, 19);
    while (pdf.getTextWidth(value) > width - 8 && pdf.getFontSize() > 7) pdf.setFontSize(pdf.getFontSize() - .5);
    pdf.text(value, x + width / 2, 81, {align: 'center'});
  });
  setText(colors.pink, 15);
  pdf.text('VENTAS', 14, 104);
  setText(colors.muted, 8);
  pdf.text('Montos en bolivianos (Bs)', 196, 104, {align: 'right'});
  autoTable(pdf, {
    startY: 111,
    head: [['Producto / combinación', 'Monto (Bs)', 'Pago', 'QR (Bs)', 'Efectivo (Bs)', 'Hora']],
    body: sales.map(sale => [sale.name, money(sale.totalCents), sale.payment, money(sale.qrCents), money(sale.cashCents), saleTime(sale)]),
    theme: 'plain',
    styles: {font, fontStyle: 'normal', fontSize: 9, cellPadding: 3.5, overflow: 'linebreak', lineWidth: 0, valign: 'middle', minCellHeight: 12},
    headStyles: {fillColor: colors.strip, textColor: colors.muted, fontStyle: 'normal', fontSize: 8},
    bodyStyles: {textColor: colors.text, fillColor: colors.card},
    alternateRowStyles: {fillColor: colors.alternate},
    columnStyles: {
      0: {cellWidth: 61}, 1: {cellWidth: 24, halign: 'right', textColor: colors.cyan},
      2: {cellWidth: 26}, 3: {cellWidth: 22, halign: 'right'},
      4: {cellWidth: 25, halign: 'right'}, 5: {cellWidth: 24, halign: 'right', textColor: colors.muted, fontSize: 8},
    },
    margin: {top: 43, left: 14, right: 14, bottom: 23},
    rowPageBreak: 'avoid',
    willDrawPage: data => { if (data.pageNumber > 1) page(); },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 2) {
        const payment = sales[data.row.index]?.payment;
        data.cell.styles.textColor = payment === 'QR' ? colors.pink : payment === 'Efectivo' ? colors.emerald : colors.cyan;
      }
    },
    didDrawCell: data => {
      if (data.section === 'body' && data.column.index === 5) {
        pdf.setDrawColor(...colors.line);
        pdf.setLineWidth(.15);
        pdf.line(14, data.cell.y + data.cell.height, 196, data.cell.y + data.cell.height);
      }
    },
  });
  if (!sales.length) {
    setText(colors.muted, 11);
    pdf.text('Sin ventas registradas', 105, 139, {align: 'center'});
  }
  const pages = pdf.internal.getNumberOfPages();
  for (let number = 1; number <= pages; number++) {
    pdf.setPage(number);
    divider(280);
    setText(colors.muted, 8);
    pdf.text('PLAN B · REPORTE DE CAJA', 14, 287);
    pdf.text(`${number} / ${pages}`, 196, 287, {align: 'right'});
  }
  return pdf;
}

export async function exportReport(sales) {
  const font = await loadReportFont();
  const pdf = createReport(sales, font);
  const date = new Date();
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  pdf.save(`plan-b-caja-${stamp}.pdf`);
}
