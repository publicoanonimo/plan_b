import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSale, prepareInventoryBatch, prepareCashEntry, cashEntryTotal, registerSales, CASH_ENTRY_ID, totals, validateProduct, validatePayment, isAvailable, toCents, money, registrationTime, saleTime, sortedSales, groupOffers} from '../src/lib/domain.js';
const products = [{id: 'ron', name: 'Ron', quantity: 2}, {id: 'cola', name: 'Cocacola', quantity: 1}];
const offer = {id: 'combo', productIds: ['ron', 'cola'], priceCents: 3500};
test('actualizar caja reemplaza el monto y solo modifica el total general', () => {
 const sale = prepareSale(offer, products, 1500, 2000);
 const previous = {...prepareCashEntry(10000), id: CASH_ENTRY_ID};
 const updated = {...prepareCashEntry(5000), id: CASH_ENTRY_ID};
 assert.deepEqual(totals([sale, previous]), {qr: 1500, cash: 2000, total: 13500});
 assert.deepEqual(totals([sale, updated]), {qr: 1500, cash: 2000, total: 8500});
 assert.equal(cashEntryTotal([sale, updated]), 5000);
 assert.equal(updated.name, 'Monto de caja');
 assert.equal(updated.payment, 'Caja');
 assert.equal(updated.cashCents, 0);
 assert.deepEqual(updated.productIds, []);
 assert.match(updated.time, /^\d{2}:\d{2}:\d{2}$/);
 assert.equal(cashEntryTotal([]), 0);
 assert.deepEqual(totals([sale, {...prepareCashEntry(0), id: CASH_ENTRY_ID}]), totals([sale]));
});
test('montos anteriores no se acumulan ni aparecen como efectivo en ventas o PDF', () => {
 const legacy = {id: 'old', kind: 'cash-entry', name: 'Monto de caja', totalCents: 10000, cashCents: 10000, qrCents: 0, payment: 'Efectivo', time: '01:00:00'};
 const current = {...prepareCashEntry(2500), id: CASH_ENTRY_ID};
 const sale = prepareSale(offer, products, 3500, 0);
 const rows = registerSales([legacy, sale, current]);
 assert.equal(rows.length, 2);
 assert.equal(rows.filter(row => row.kind === 'cash-entry').length, 1);
 assert.equal(cashEntryTotal(rows), 2500);
 assert.deepEqual(totals([legacy, sale, current]), {qr: 3500, cash: 0, total: 6000});
 assert.deepEqual(totals(rows), totals([legacy, sale, current]));
 assert.equal(registerSales([legacy])[0].cashCents, 0);
 assert.equal(registerSales([legacy])[0].payment, 'Caja');
});
test('caja permite cero y rechaza negativos, fracciones de centavo y valores inválidos', () => {
 for (const amount of [-1, 0.5, NaN, Infinity, '100', 10000000001]) assert.throws(() => prepareCashEntry(amount));
 assert.equal(prepareCashEntry(0).totalCents, 0);
 assert.equal(prepareCashEntry(1).totalCents, 1);
});
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

test('cajas separa preparados, combos de dos productos y unitarios en ese orden', () => {
 const products = [{id: 'jarra', name: 'Jarras de singani', prepared: true}, {id: 'mix', name: 'Mezclables'}, {id: 'a', name: 'Ron'}, {id: 'b', name: 'Cola'}];
 const offers = [
  {id: 'dos-jarras', productIds: ['jarra'], productQuantities: {jarra: 2}},
  {id: 'jarra-con-cola', productIds: ['jarra', 'b']},
  {id: 'mezclable', productIds: ['mix', 'b']},
  {id: 'botella', productIds: ['a', 'b']},
  {id: 'unitario', productIds: ['a']},
 ];
 const before = structuredClone(offers);
 const groups = groupOffers(offers, products);
 assert.deepEqual(groups.map(g => g.name), ['Preparados', 'Combo de botellas', 'Unitarios']);
 assert.deepEqual(groups.map(g => g.offers.map(o => o.id)), [['dos-jarras', 'jarra-con-cola', 'mezclable'], ['botella'], ['unitario']]);
 assert.deepEqual(offers, before);
 assert.equal(groupOffers([], []).length, 3);
});
test('cajas conserva tarjetas mayores y con productos eliminados para poder editarlas', () => {
 const offers = [{id: 'tres', productIds: ['a', 'b', 'c']}, {id: 'eliminado', productIds: ['missing']}];
 const groups = groupOffers(offers, []);
 assert.deepEqual(groups.map(g => g.id), ['preparados', 'botellas', 'otros', 'unitarios']);
 assert.equal(groups[2].offers[0].id, 'tres');
 assert.equal(groups[3].offers[0].id, 'eliminado');
 const edited = groupOffers([{id: 'editado', productIds: ['a', 'b']}]);
 assert.equal(edited[1].offers[0].id, 'editado');
});

test('preparado conserva ingredientes y cantidades totales sin multiplicarlas por unidades elaboradas', () => {
 const inventory = products.map(product => ({...product, kind: 'inventory'}));
 const before = structuredClone(inventory);
 const prepared = prepareInventoryBatch({name: '  Cóctel  ', quantity: '8', ingredients: [{productId: 'ron', quantity: '2'}, {productId: 'cola', quantity: '1'}]}, inventory);
 assert.equal(prepared.name, 'Cóctel');
 assert.equal(prepared.quantity, 8);
 assert.equal(prepared.preparedQuantity, 8);
 assert.equal(prepared.prepared, true);
 assert.deepEqual(prepared.ingredients, [{productId: 'ron', name: 'Ron', quantity: 2}, {productId: 'cola', name: 'Cocacola', quantity: 1}]);
 assert.deepEqual(inventory, before);
});
test('preparado rechaza cantidades inválidas, duplicados, falta de existencias o productos eliminados', () => {
 const inventory = products.map(product => ({...product, kind: 'inventory'}));
 const valid = {name: 'Cóctel', quantity: 8, ingredients: [{productId: 'ron', quantity: 1}]};
 for (const quantity of [0, -1, 1.5, '', NaN]) assert.throws(() => prepareInventoryBatch({...valid, quantity}, inventory));
 for (const quantity of [0, -1, 1.5, '', NaN, 3]) assert.throws(() => prepareInventoryBatch({...valid, ingredients: [{productId: 'ron', quantity}]}, inventory));
 assert.throws(() => prepareInventoryBatch({...valid, ingredients: []}, inventory));
 assert.throws(() => prepareInventoryBatch({...valid, ingredients: [valid.ingredients[0], valid.ingredients[0]]}, inventory));
 assert.throws(() => prepareInventoryBatch(valid, []), /ya no existe/);
 assert.throws(() => prepareInventoryBatch(valid, [{...inventory[0], quantity: 0}]), /insuficientes/);
});

test('tarjeta permite configurar ingredientes agotados sin descontarlos', async () => {
 const {prepareRecipe} = await import('../src/lib/domain.js');
 const inventory = [{id: 'ron', kind: 'inventory', name: 'Ron', quantity: 0}];
 const recipe = prepareRecipe({name: 'Cóctel', quantity: 8, ingredients: [{productId: 'ron', quantity: 2}]}, inventory);
 assert.equal(recipe.kind, 'recipe');
 assert.equal(recipe.quantity, 8);
 assert.equal(inventory[0].quantity, 0);
 assert.throws(() => prepareRecipe({...recipe, ingredients: [{productId: 'missing', quantity: 1}]}, inventory));
});

test('preparar, aumentar, reducir y borrar conserva las cantidades de ingredientes', async () => {
 const {prepareRecipe, preparationPlan, preparationRefund} = await import('../src/lib/domain.js');
 const inventory = [{id: 'ron', kind: 'inventory', name: 'Ron', quantity: 10}, {id: 'cola', kind: 'inventory', name: 'Cola', quantity: 20}];
 const recipe = {...prepareRecipe({name: 'Cóctel', quantity: 8, ingredients: [{productId: 'ron', quantity: 2}, {productId: 'cola', quantity: 3}]}, inventory), id: 'recipe'};
 const first = preparationPlan(recipe, 16, inventory);
 assert.equal(first.product.quantity, 16);
 assert.deepEqual(first.updates.map(p => p.quantity), [6, 14]);
 const increased = preparationPlan(recipe, 24, first.updates, first.product);
 assert.equal(increased.product.quantity, 24);
 assert.deepEqual(increased.updates.map(p => p.quantity), [4, 11]);
 const reduced = preparationPlan(recipe, 8, increased.updates, increased.product);
 assert.deepEqual(reduced.updates.map(p => p.quantity), [8, 17]);
 assert.deepEqual(preparationRefund(reduced.product, reduced.updates).map(p => p.quantity), [10, 20]);
 for (const amount of [0, 7, 9, -8, 8.5, Infinity]) assert.throws(() => preparationPlan(recipe, amount, inventory));
 assert.throws(() => preparationPlan(recipe, 80, inventory), /insuficientes/);
 assert.throws(() => preparationPlan(recipe, 8, []), /ya no existe/);
});

test('editar conserva ventas realizadas y usa la receta original aunque cambie la tarjeta', async () => {
 const {preparationPlan, preparationRefund} = await import('../src/lib/domain.js');
 const recipe = {id: 'recipe', name: 'Cóctel', quantity: 8, ingredients: [{productId: 'ron', name: 'Ron', quantity: 2}]};
 const inventory = [{id: 'ron', kind: 'inventory', name: 'Ron', quantity: 20}];
 const batch = preparationPlan(recipe, 16, inventory);
 const afterSale = {...batch.product, quantity: 13};
 const editedRecipe = {...recipe, quantity: 1, ingredients: []};
 const edit = preparationPlan(editedRecipe, 8, batch.updates, afterSale);
 assert.equal(edit.product.quantity, 5);
 assert.equal(edit.updates[0].quantity, 18);
 assert.throws(() => preparationPlan(recipe, 8, batch.updates, {...afterSale, quantity: 1}), /Ya se utilizaron/);
 assert.equal(preparationRefund(batch.product, [])[0].quantity, 4);
});

test('combos de jarras muestran cantidad, se agrupan en preparados y exigen stock completo', () => {
 const products = [{id: 'jarra', name: 'Jarras', prepared: true, quantity: 2}];
 const offer = {id: 'combo', productIds: ['jarra'], productQuantities: {jarra: 3}, priceCents: 5000};
 assert.equal(isAvailable(offer, products), false);
 assert.throws(() => prepareSale(offer, products, 5000, 0), /suficientes/);
 assert.equal(groupOffers([offer], products)[0].offers[0].id, 'combo');
 const sale = prepareSale(offer, [{...products[0], quantity: 3}], 5000, 0);
 assert.equal(sale.name, '3 × Jarras');
 assert.equal(sale.productQuantities.jarra, 3);
 assert.equal(isAvailable({...offer, productQuantities: {jarra: 0}}, products), false);
 const legacy = {...offer};
 delete legacy.productQuantities;
 assert.equal(isAvailable(legacy, products), true);
 assert.equal(prepareSale(legacy, products, 5000, 0).productQuantities.jarra, 1);
});
