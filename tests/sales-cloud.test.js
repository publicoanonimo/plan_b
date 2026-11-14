import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {documents, put, emit, reset, trace, controls, subscriptions, dataCalls} from './helpers/sales-firestore.js';
const fixtureURL = new URL('./helpers/sales-firestore.js', import.meta.url).href;
registerHooks({resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/src/lib/store.js') && (specifier === './firebase.js' || specifier === 'firebase/firestore')) return {url: fixtureURL, shortCircuit: true};
  return nextResolve(specifier, context);
}});
const store = await import('../src/lib/store.js');
const offer = {id: 'combo', kind: 'offer', priceCents: 3500, productIds: ['ron', 'cola']};
function seed(quantity = 5) {
  reset();
  put('posProducts/combo', offer);
  put('posProducts/ron', {kind: 'inventory', name: 'Ron', quantity});
  put('posProducts/cola', {kind: 'inventory', name: 'Cola', quantity});
}
const sales = () => [...documents].filter(([path]) => path.startsWith('posSales/')).map(([, sale]) => sale);
const firstReads = () => trace.slice(0, trace.findIndex(event => event.type === 'read-end')).filter(event => event.type === 'read-start').map(event => event.path);

test('venta: tarjeta y stock se leen en paralelo y se guardan juntos; QR, efectivo y mixto', async () => {
  seed();
  await store.recordSale('combo', 3500, 0, offer);
  assert.deepEqual(firstReads(), ['posProducts/combo', 'posProducts/ron', 'posProducts/cola']);
  assert.equal(trace.filter(event => event.type === 'read-start').length, 3);
  assert.equal(trace.filter(event => event.type === 'commit').length, 1);
  await store.recordSale('combo', 0, 3500, offer);
  await store.recordSale('combo', 1000, 2500, offer);
  assert.equal(documents.get('posProducts/ron').quantity, 2);
  assert.equal(documents.get('posProducts/cola').quantity, 2);
  assert.deepEqual(sales().map(sale => sale.payment), ['QR', 'Efectivo', 'QR + Efectivo']);
  assert.ok(sales().every(sale => sale.name === 'Ron + Cola' && sale.totalCents === 3500));
});

test('venta sin tarjeta en memoria conserva el flujo seguro de dos tandas de lectura', async () => {
  seed();
  await store.recordSale('combo', 3500, 0);
  assert.deepEqual(firstReads(), ['posProducts/combo']);
  assert.equal(sales().length, 1);
});

test('tarjeta desactualizada y reintento usan productos y cantidades del servidor', async () => {
  seed();
  put('posProducts/jarra', {kind: 'inventory', prepared: true, name: 'Jarras', quantity: 6});
  controls.beforeCommit = () => put('posProducts/combo', {...offer, productIds: ['jarra'], productQuantities: {jarra: 2}});
  await store.recordSale('combo', 3500, 0, offer);
  assert.equal(trace.filter(event => event.type === 'attempt').length, 2);
  assert.equal(trace.filter(event => event.type === 'commit').length, 1);
  assert.equal(documents.get('posProducts/jarra').quantity, 4);
  assert.equal(documents.get('posProducts/ron').quantity, 5);
  assert.equal(documents.get('posProducts/cola').quantity, 5);
  assert.equal(sales().length, 1);
  assert.equal(sales()[0].name, '2 × Jarras');
  assert.deepEqual(sales()[0].productIds, ['jarra']);
});

test('dos cajas compitiendo por la última unidad no duplican la venta ni dejan stock negativo', async () => {
  seed(1);
  const results = await Promise.allSettled([store.recordSale('combo', 3500, 0, offer), store.recordSale('combo', 0, 3500, offer)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(sales().length, 1);
  assert.equal(documents.get('posProducts/ron').quantity, 0);
  assert.equal(documents.get('posProducts/cola').quantity, 0);
});

test('precio cambiado, producto eliminado o tipo inválido no registran movimientos', async () => {
  for (const mutate of [
    () => put('posProducts/combo', {...offer, priceCents: 4000}),
    () => put('posProducts/ron'),
    () => put('posProducts/ron', {kind: 'offer', name: 'Inválido', quantity: 5}),
    () => put('posProducts/combo'),
  ]) {
    seed(); mutate();
    const before = structuredClone([...documents]);
    await assert.rejects(store.recordSale('combo', 3500, 0, offer));
    assert.deepEqual([...documents], before);
  }
});

test('el registro espera confirmación y un fallo de conexión no aplica descuentos parciales', async () => {
  seed();
  controls.commitError = new Error('Sin conexión');
  const before = structuredClone([...documents]);
  await assert.rejects(store.recordSale('combo', 3500, 0, offer), /Sin conexión/);
  assert.deepEqual([...documents], before);
  controls.commitError = null;
  let finished = false;
  controls.beforeCommit = () => {assert.equal(finished, false); assert.equal(sales().length, 0);};
  await store.recordSale('combo', 3500, 0, offer).then(() => {finished = true;});
  assert.equal(finished, true);
  assert.equal(sales().length, 1);
});

test('Caja y Editor cargan catálogo sin descargar historial ni registro de usuarios', async t => {
  seed();
  put('posProducts/__access_users_v1', {kind: 'access-users', users: [{name: 'Privado'}]});
  put('posSales/old', {totalCents: 3500});
  let state;
  const stop = store.subscribe(value => {state = value;}, error => {throw error;}, {includeSales: false});
  t.after(stop);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(subscriptions.length, 1);
  assert.deepEqual(subscriptions[0].reference.filter, {field: 'kind', operator: 'in', value: ['inventory', 'offer', 'recipe']});
  assert.equal(state.products.length, 2);
  assert.equal(state.offers.length, 1);
  assert.deepEqual(state.sales, []);
  assert.equal(dataCalls.has('posSales/old'), false);
  assert.equal(dataCalls.has('posProducts/__access_users_v1'), false);
});

test('actualizaciones incrementales conservan tarjetas/fotos y no reprocesan documentos sin cambios', async t => {
  seed();
  put('posProducts/combo', {...offer, photo: 'large-photo'});
  let state;
  let notifications = 0;
  const stop = store.subscribe(value => {state = value; notifications++;}, error => {throw error;});
  t.after(stop);
  await new Promise(resolve => setTimeout(resolve, 0));
  const initial = state;
  dataCalls.clear();
  put('posProducts/ron', {kind: 'inventory', name: 'Ron', quantity: 4});
  emit();
  assert.equal(state.offers, initial.offers);
  assert.equal(state.offers[0], initial.offers[0]);
  assert.equal(state.sales, initial.sales);
  assert.equal(dataCalls.has('posProducts/combo'), false);
  assert.equal(dataCalls.has('posProducts/cola'), false);
  assert.equal(state.products.find(product => product.id === 'ron').quantity, 4);
  const afterStock = state;
  put('posSales/new', {name: 'Venta', totalCents: 3500}); emit();
  assert.equal(state.products, afterStock.products);
  assert.equal(state.offers, afterStock.offers);
  assert.equal(state.sales.length, 1);
  const count = notifications;
  emit();
  assert.equal(notifications, count);
  put('posProducts/combo'); emit();
  assert.equal(state.offers.length, 0);
  put('posProducts/ron', {kind: 'recipe', name: 'Receta', ingredients: []}); emit();
  assert.equal(state.products.some(product => product.id === 'ron'), false);
  assert.equal(state.recipes.length, 1);
  put('posSales/new'); emit();
  assert.equal(state.sales.length, 0);
});
