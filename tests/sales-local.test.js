import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  if (specifier === './firebase.js' && context.parentURL?.endsWith('/src/lib/store.js')) return {url: 'data:text/javascript,export const db=null;export const cloudEnabled=false;', shortCircuit: true};
  return next(specifier, context);
}});
const KEY = 'plan-b-pos-v1';
const storage = new Map();
const events = new Set();
let writeError = null;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem(key, value) {if (writeError) throw writeError; storage.set(key, value);},
};
globalThis.window = {addEventListener(_type, listener) {events.add(listener);}, removeEventListener(_type, listener) {events.delete(listener);}};
let queue = Promise.resolve();
Object.defineProperty(globalThis, 'navigator', {value: {locks: {request(_key, update) {
  const result = queue.catch(() => {}).then(update); queue = result; return result;
}}}, configurable: true});
const store = await import('../src/lib/store.js');

test('modo local reutiliza tarjetas/fotos y conserva snapshots anteriores al registrar', async t => {
  storage.clear();
  let state;
  let notifications = 0;
  const stop = store.subscribe(value => {state = value; notifications++;}, error => {throw error;});
  t.after(stop);
  await store.saveProduct({name: 'Ron', quantity: 3}, 'ron');
  await store.saveProduct({name: 'Cola', quantity: 3}, 'cola');
  await store.saveOffer(['ron'], 3500, 'combo', {}, 'data:image/jpeg;base64,/9j/AAAA');
  const initial = state;
  await store.recordSale('combo', 3500, 0);
  assert.equal(state.offers, initial.offers);
  assert.equal(state.offers[0], initial.offers[0]);
  assert.equal(state.products.find(product => product.id === 'cola'), initial.products.find(product => product.id === 'cola'));
  assert.equal(initial.sales.length, 0);
  assert.equal(initial.products.find(product => product.id === 'ron').quantity, 3);
  assert.equal(state.products.find(product => product.id === 'ron').quantity, 2);
  const beforeFailure = state;
  const saved = storage.get(KEY);
  const count = notifications;
  writeError = new Error('Almacenamiento lleno');
  try {await assert.rejects(store.recordSale('combo', 0, 3500), /Almacenamiento lleno/);}
  finally {writeError = null;}
  assert.equal(storage.get(KEY), saved);
  assert.equal(state, beforeFailure);
  assert.equal(state.sales.length, 1);
  assert.equal(notifications, count);
});

test('la caché local detecta cambios de otra pestaña y relee stock antes de vender', async t => {
  storage.clear();
  let state;
  const stop = store.subscribe(value => {state = value;}, error => {throw error;}, {includeSales: false});
  t.after(stop);
  await store.saveProduct({name: 'Ron', quantity: 2}, 'ron');
  await store.saveOffer(['ron'], 3500, 'combo');
  const external = JSON.parse(storage.get(KEY));
  external.products[0].quantity = 0;
  storage.set(KEY, JSON.stringify(external));
  await assert.rejects(store.recordSale('combo', 3500, 0), /agotado/);
  for (const listener of events) listener({key: KEY});
  assert.equal(state.products[0].quantity, 0);
  external.products[0].quantity = 1;
  external.products[0].name = 'Ron actualizado';
  storage.set(KEY, JSON.stringify(external));
  const results = await Promise.allSettled([store.recordSale('combo', 3500, 0), store.recordSale('combo', 0, 3500)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const saved = JSON.parse(storage.get(KEY));
  assert.equal(saved.products[0].quantity, 0);
  assert.equal(saved.sales.length, 1);
  assert.equal(saved.sales[0].name, 'Ron actualizado');
  assert.deepEqual(state.sales, []);
});
