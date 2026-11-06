import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSale, totals, validateProduct, validatePayment, isAvailable, toCents, money, registrationTime, saleTime, sortedSales, groupOffers} from '../src/lib/domain.js';
const products = [{id: 'ron', name: 'Ron', quantity: 2}, {id: 'cola', name: 'Cocacola', quantity: 1}];
const offer = {id: 'combo', productIds: ['ron', 'cola'], priceCents: 3500};
test('combinación conserva nombres y reparte el pago sin duplicar el total', () => {
 const sale = prepareSale(offer, products, 1500, 2000);
 assert.equal(sale.name, 'Ron + Cocacola');
 assert.equal(sale.payment, 'QR + Efectivo');
 assert.deepEqual(totals([sale, prepareSale(offer, products, 3500, 0), prepareSale(offer, products, 0, 3500)]), {qr: 5000, cash: 5500, total: 10500});
});
test('no permite cobrar montos incompletos, negativos, inválidos o excedidos', () => {
 for (const [qr, cash] of [[1000, 1000], [3500, 1], [-1, 3501], [NaN, 0], [1.5, 3498.5]]) assert.throws(() => validatePayment(3500, qr, cash));
});
test('bloquea venta si cualquier ingrediente falta o está agotado', () => {
 const exhausted = products.map(p => ({...p, quantity: p.id === 'cola' ? 0 : p.quantity}));
 assert.equal(isAvailable(offer, exhausted), false);
 assert.throws(() => prepareSale(offer, exhausted, 3500, 0), /agotado/);
 assert.throws(() => prepareSale(offer, products.slice(0, 1), 3500, 0));
});
test('inventario solo admite nombres válidos y cantidades enteras no negativas', () => {
 for (const [name, qty] of [['', 2], ['Ron', -1], ['Ron', 1.5], ['Ron', ''], ['Ron', Infinity]]) assert.throws(() => validateProduct(name, qty));
 assert.doesNotThrow(() => validateProduct('Ron', 0));
});
test('dinero se calcula en centavos y total vacío es cero', () => {
 assert.equal(toCents('10.10'), 1010);
 assert.equal(toCents('0.29'), 29);
 assert.deepEqual(totals([]), {qr: 0, cash: 0, total: 0});
});

test('montos enteros sin decimales y centavos con precisión', () => {
 assert.equal(money(0), '0');
 assert.equal(money(3500), '35');
 assert.equal(money(3550), '35,50');
 assert.equal(money(3501), '35,01');
 assert.equal(money(5), '0,05');
});

test('las ventas nuevas guardan solo la hora sin fecha', () => {
 const sale = prepareSale(offer, products, 3500, 0);
 assert.match(sale.time, /^\d{2}:\d{2}:\d{2}$/);
 assert.equal('createdAt' in sale, false);
 assert.equal(registrationTime(new Date(2026, 10, 6, 9, 5, 3)), '09:05:03');
});
test('ventas anteriores muestran solo la hora y el orden cruza medianoche', () => {
 const legacyDate = new Date(2026, 10, 6, 23, 58, 0);
 assert.equal(saleTime({createdAt: legacyDate.toISOString()}), '23:58:00');
 const rows = [{id: 'antes', time: '23:58:00'}, {id: 'despues', time: '00:01:00'}];
 assert.deepEqual(sortedSales(rows, new Date(2026, 10, 7, 0, 5)).map(s=>s.id), ['despues', 'antes']);
});

test('cajas agrupa por cantidad seleccionada, mantiene secciones 1 a 3 y conserva combinaciones mayores', () => {
 const offers = [{id: 'tres', productIds: ['a', 'b', 'c']}, {id: 'uno', productIds: ['a']}, {id: 'cuatro', productIds: ['a', 'b', 'c', 'd']}, {id: 'dos', productIds: ['a', 'b']}];
 const groups = groupOffers(offers);
 assert.deepEqual(groups.map(g => g.count), [1, 2, 3, 4]);
 assert.deepEqual(groups.map(g => g.offers[0].id), ['uno', 'dos', 'tres', 'cuatro']);
 assert.deepEqual(groupOffers([]).map(g => g.count), [1, 2, 3]);
 assert.equal(offers[0].id, 'tres');
});
test('editar la cantidad de productos cambia automáticamente la sección de venta', () => {
 const offer = {id: 'combo', productIds: ['a', 'b']};
 assert.equal(groupOffers([offer])[1].offers[0].id, 'combo');
 const edited = {...offer, productIds: ['a', 'b', 'c']};
 const groups = groupOffers([edited]);
 assert.equal(groups[1].offers.length, 0);
 assert.equal(groups[2].offers[0].id, 'combo');
});
