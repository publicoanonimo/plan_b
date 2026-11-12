import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { money, totals, saleTime, registerSales } from './domain.js';

async function loadLogo() {
  const image = new Image();
  image.src = '/plan-b-logo.jpeg';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.beginPath();
  context.arc(128, 128, 128, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, 0, 0, 256, 256);
  return canvas.toDataURL('image/png');
}

export function createReport(sales, logo) {
  sales = registerSales(sales);
  const pdf = new jsPDF({format: 'a4', unit: 'mm'});
  const total = totals(sales);
  const issuedAt = new Date();
  const navy = [35, 33, 49];
  const gold = [239, 194, 112];
  const header = () => {
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, 210, 39, 'F');
    if (logo) pdf.addImage(logo, 'PNG', 14, 7, 24, 24);
    const x = logo ? 44 : 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(23);
    pdf.setTextColor(...gold);
    pdf.text('PLAN B', x, 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(239, 234, 246);
    pdf.text('Reporte de caja', x, 29);
    pdf.setFillColor(...gold);
    pdf.rect(0, 38, 210, 1, 'F');
  };
  header();
  pdf.setTextColor(103, 98, 115);
  pdf.setFontSize(9);
  pdf.text(issuedAt.toLocaleTimeString('es-BO'), 14, 52);
  pdf.text(`Ventas: ${sales.length}`, 196, 52, {align: 'right'});
  [
    ['Total QR', total.qr, [125, 66, 203], [255, 255, 255]],
    ['Total efectivo', total.cash, [21, 137, 97], [255, 255, 255]],
    ['Total de caja', total.total, gold, navy],
  ].forEach(([label, amount, color, textColor], i) => {
    const width = 56.666;
    const x = 14 + i * (width + 6);
    pdf.setFillColor(...color);
    pdf.roundedRect(x, 62, width, 33, 3, 3, 'F');
    pdf.setTextColor(...textColor);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(label, x + width / 2, 73, {align: 'center'});
    pdf.setFont('helvetica', 'bold');
    const value = `Bs ${money(amount)}`;
    let fontSize = 20;
    pdf.setFontSize(fontSize);
    while (pdf.getTextWidth(value) > width - 10 && fontSize > 8) pdf.setFontSize(--fontSize);
    pdf.text(value, x + width / 2, 87, {align: 'center'});
  });
  pdf.setTextColor(...navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Ventas', 14, 108);
  autoTable(pdf, {
    startY: 114,
    head: [['Producto / combinación', 'Monto (Bs)', 'Pago', 'QR (Bs)', 'Efectivo (Bs)', 'Hora']],
    body: sales.map(sale => [sale.name, money(sale.totalCents), sale.payment, money(sale.qrCents), money(sale.cashCents), saleTime(sale)]),
    theme: 'plain',
    headStyles: {fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8},
    bodyStyles: {textColor: [53, 48, 66], fillColor: [255, 255, 255]},
    alternateRowStyles: {fillColor: [246, 243, 250]},
    styles: {font: 'helvetica', fontSize: 8.5, cellPadding: 3.5, overflow: 'linebreak', lineWidth: 0, valign: 'middle'},
    columnStyles: {0: {cellWidth: 57}, 1: {cellWidth: 22, halign: 'right', fontStyle: 'bold'}, 2: {cellWidth: 30}, 3: {cellWidth: 21, halign: 'right'}, 4: {cellWidth: 24, halign: 'right'}, 5: {cellWidth: 28, fontSize: 7.5}},
    margin: {top: 48, left: 14, right: 14, bottom: 23},
    rowPageBreak: 'avoid',
    willDrawPage: header,
  });
  if (!sales.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(111, 103, 123);
    pdf.text('Sin ventas registradas', 14, 139);
  }
  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFillColor(...gold);
    pdf.rect(14, 280, 182, .4, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(116, 107, 127);
    pdf.text('PLAN B', 14, 287);
    pdf.text(`${page} / ${pages}`, 196, 287, {align: 'right'});
  }
  return pdf;
}

export async function exportReport(sales) {
  const logo = await loadLogo();
  const pdf = createReport(sales, logo);
  const date = new Date();
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  pdf.save(`plan-b-caja-${stamp}.pdf`);
}
