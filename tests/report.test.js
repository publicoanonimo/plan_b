import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReport} from '../src/lib/report.js';
import {CASH_ENTRY_ID} from '../src/lib/domain.js';

const font = readFileSync(new URL('../public/fonts/Anton-Regular.ttf', import.meta.url)).toString('base64');
const sale = {id: 'sale', name: 'Ron añejo + bebida de maracuyá', totalCents: 3500, qrCents: 1500, cashCents: 2000, payment: 'QR + Efectivo', time: '23:15:08'};

test('reporte incorpora Anton, conserva el pago mixto y normaliza el monto de caja', () => {
  const pdf = createReport([
    sale,
    {id: 'previous', kind: 'cash-entry', name: 'Monto de caja', totalCents: 9900, cashCents: 9900, time: '20:00:00'},
    {id: CASH_ENTRY_ID, kind: 'cash-entry', name: 'Monto de caja', totalCents: 5000, cashCents: 5000, time: '21:00:00'},
  ], font);
  assert.equal(pdf.getFont().fontName, 'Anton');
  const rows = pdf.lastAutoTable.body;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].raw, [sale.name, '35', 'QR + Efectivo', '15', '20', '23:15:08']);
  assert.deepEqual(rows[1].raw, ['Monto de caja', '50', 'Caja', '0', '0', '21:00:00']);
});

test('reporte vacío sigue siendo un PDF válido de una página', () => {
  const pdf = createReport([], font);
  assert.equal(pdf.internal.getNumberOfPages(), 1);
  assert.equal(pdf.lastAutoTable.body.length, 0);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});

test('reporte extenso conserva las filas y las distribuye sin invadir el pie', () => {
  const sales = Array.from({length: 120}, (_, index) => ({...sale, id: String(index), name: `${index + 1}. ${'Combinación de bebidas preparadas · '.repeat(3)}`}));
  const pdf = createReport(sales, font);
  assert.ok(pdf.internal.getNumberOfPages() > 1);
  assert.equal(pdf.lastAutoTable.body.length, sales.length);
  for (const row of pdf.lastAutoTable.body) {
    const cell = row.cells[0];
    assert.ok(cell.y >= 43);
    assert.ok(cell.y + cell.height <= 274.1);
  }
});
