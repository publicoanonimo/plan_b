import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, runTransaction, writeBatch } from 'firebase/firestore';
import { prepareSale, validateProduct } from './domain.js';
const env = import.meta.env;
export const cloudEnabled = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
const db = cloudEnabled ? getFirestore(initializeApp({apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID})) : null;
const KEY = 'plan-b-pos-v1';
const empty = () => ({products: [], offers: [], sales: []});
function readLocal() { const saved = localStorage.getItem(KEY); return saved ? JSON.parse(saved) : empty(); }
let local;
const listeners = new Set();
function notify() { for (const listener of listeners) listener(local); }
async function mutateLocal(action) {
  const update = () => { local = readLocal(); action(local); localStorage.setItem(KEY, JSON.stringify(local)); notify(); };
  if (navigator.locks) await navigator.locks.request(KEY, update); else update();
}
export function subscribe(next, fail) {
  if (!db) {
    const listener = data => next({...data});
    const refresh = () => { try { local = readLocal(); listener(local); } catch { fail(new Error('No se pudieron leer los datos locales. Verifica el almacenamiento del navegador.')); } };
    refresh(); listeners.add(listener); window.addEventListener('storage', refresh);
    return () => {listeners.delete(listener); window.removeEventListener('storage', refresh);};
  }
  let state = empty();
  return (() => {
    const stops = [onSnapshot(collection(db, 'posProducts'), snapshot => { const all = snapshot.docs.map(d => ({...d.data(), id: d.id})); state = {...state, products: all.filter(d => d.kind !== 'offer'), offers: all.filter(d => d.kind === 'offer')}; next(state); }, fail), onSnapshot(collection(db, 'posSales'), snapshot => {state = {...state, sales: snapshot.docs.map(d => ({...d.data(), id: d.id}))}; next(state);}, fail)];
    return () => stops.forEach(stop => stop());
  })();
}
export async function saveProduct(data, id = crypto.randomUUID()) {
  validateProduct(data.name, data.quantity);
  const product = {id, kind: 'inventory', name: data.name.trim(), quantity: Number(data.quantity)};
  if (db) await setDoc(doc(db, 'posProducts', id), product);
  else await mutateLocal(state => {const index = state.products.findIndex(p => p.id === id); if (index < 0) state.products.push(product); else state.products[index] = product;});
}
export async function saveOffer(productIds, priceCents, id = crypto.randomUUID()) {
  if (!productIds.length || new Set(productIds).size !== productIds.length || !Number.isSafeInteger(priceCents) || priceCents <= 0) throw new Error('Selecciona productos e ingresa un precio mayor a cero.');
  const offer = {id, kind: 'offer', productIds, priceCents};
  if (db) await runTransaction(db, async transaction => {
    const existing = await transaction.get(doc(db, 'posProducts', id));
    const retainedIds = existing.exists() ? existing.data().productIds || [] : [];
    const snapshots = await Promise.all(productIds.map(pid => transaction.get(doc(db, 'posProducts', pid))));
    if (!snapshots.every(s => s.exists() && s.data().kind === 'inventory' && (s.data().quantity > 0 || retainedIds.includes(s.id)))) throw new Error('Los productos seleccionados deben estar disponibles.');
    transaction.set(doc(db, 'posProducts', id), offer);
  });
  else await mutateLocal(state => {
    const index = state.offers.findIndex(p => p.id === id);
    const retainedIds = index >= 0 ? state.offers[index].productIds : [];
    if (!productIds.every(pid => state.products.some(p => p.id === pid && (p.quantity > 0 || retainedIds.includes(pid))))) throw new Error('Los productos seleccionados deben estar disponibles.');
    if (index < 0) state.offers.push(offer); else state.offers[index] = offer;
  });
}
export async function removeItem(kind, id) {
  if (db) await deleteDoc(doc(db, 'posProducts', id));
  else await mutateLocal(state => {state[kind] = state[kind].filter(p => p.id !== id);});
}
export async function recordSale(offerId, qrCents, cashCents) {
  const id = crypto.randomUUID();
  if (db) {
    await runTransaction(db, async transaction => {
      const offerDoc = await transaction.get(doc(db, 'posProducts', offerId));
      if (!offerDoc.exists()) throw new Error('Esta opción de venta ya no existe.');
      const offer = {...offerDoc.data(), id: offerId};
      const snapshots = await Promise.all(offer.productIds.map(pid => transaction.get(doc(db, 'posProducts', pid))));
      const products = snapshots.filter(s => s.exists()).map(s => ({...s.data(), id: s.id}));
      const sale = prepareSale(offer, products, qrCents, cashCents);
      products.forEach(p => transaction.update(doc(db, 'posProducts', p.id), {quantity: p.quantity - 1}));
      transaction.set(doc(db, 'posSales', id), {...sale, id});
    });
  } else await mutateLocal(state => {
    const offer = state.offers.find(o => o.id === offerId);
    if (!offer) throw new Error('Esta opción de venta ya no existe.');
    const sale = prepareSale(offer, state.products, qrCents, cashCents);
    state.products = state.products.map(p => offer.productIds.includes(p.id) ? {...p, quantity: p.quantity - 1} : p);
    state.sales.push({...sale, id});
  });
}

export async function closeRegister(saleIds) {
  const ids = [...new Set(saleIds)];
  if (db) {
    for (let offset = 0; offset < ids.length; offset += 400) {
      const batch = writeBatch(db);
      ids.slice(offset, offset + 400).forEach(id => batch.delete(doc(db, 'posSales', id)));
      await batch.commit();
    }
  } else {
    const closingIds = new Set(ids);
    await mutateLocal(state => {state.sales = state.sales.filter(sale => !closingIds.has(sale.id));});
  }
}
