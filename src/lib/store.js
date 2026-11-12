import { collection, doc, onSnapshot, setDoc, runTransaction, writeBatch } from 'firebase/firestore';
import { prepareSale, prepareCashEntry, prepareRecipe, preparationPlan, preparationRefund, validateProduct, offerQuantity, CASH_ENTRY_ID } from './domain.js';
import { db } from './firebase.js';
import { validateOfferPhoto } from './offerPhoto.js';
export { cloudEnabled } from './firebase.js';
const KEY = 'plan-b-pos-v1';
const empty = () => ({products: [], offers: [], sales: [], recipes: []});
function readLocal() { const saved = localStorage.getItem(KEY); return saved ? {...empty(), ...JSON.parse(saved)} : empty(); }
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
  const ready = new Set();
  const publish = source => {
    ready.add(source);
    if (ready.size === 2) next(state);
  };
  const stops = [
    onSnapshot(collection(db, 'posProducts'), snapshot => {
      const all = snapshot.docs.map(document => ({...document.data(), id: document.id}));
      state = {...state, products: all.filter(item => item.kind === 'inventory'), offers: all.filter(item => item.kind === 'offer'), recipes: all.filter(item => item.kind === 'recipe')};
      publish('products');
    }, fail),
    onSnapshot(collection(db, 'posSales'), snapshot => {
      state = {...state, sales: snapshot.docs.map(document => ({...document.data(), id: document.id}))};
      publish('sales');
    }, fail),
  ];
  return () => stops.forEach(stop => stop());
}

export async function saveProduct(data, id = crypto.randomUUID()) {
  validateProduct(data.name, data.quantity);
  const product = {id, kind: 'inventory', name: data.name.trim(), quantity: Number(data.quantity)};
  if (db) await runTransaction(db, async transaction => {
    const existing = await transaction.get(doc(db, 'posProducts', id));
    if (existing.data()?.prepared) throw new Error('Edita la cantidad desde Preparar bebidas.');
    transaction.set(doc(db, 'posProducts', id), product, {merge: true});
  });
  else await mutateLocal(state => {const index = state.products.findIndex(p => p.id === id); if (state.products[index]?.prepared) throw new Error('Edita la cantidad desde Preparar bebidas.'); if (index < 0) state.products.push(product); else state.products[index] = {...state.products[index], ...product};});
}
export async function saveRecipe(data, id = crypto.randomUUID()) {
  if (db) await runTransaction(db, async transaction => {
    const existing = await transaction.get(doc(db, 'posProducts', id));
    if (data.id && (!existing.exists() || existing.data().kind !== 'recipe')) throw new Error('La tarjeta ya no existe.');
    const snapshots = await Promise.all((data.ingredients || []).map(item => transaction.get(doc(db, 'posProducts', item.productId))));
    const products = snapshots.filter(s => s.exists()).map(s => ({...s.data(), id: s.id}));
    transaction.set(doc(db, 'posProducts', id), {...prepareRecipe(data, products), id});
  });
  else await mutateLocal(state => {
    if (data.id && !state.recipes.some(recipe => recipe.id === id)) throw new Error('La tarjeta ya no existe.');
    const recipe = {...prepareRecipe(data, state.products), id};
    state.recipes = [...state.recipes.filter(item => item.id !== id), recipe];
  });
}

// Both preparation and refunds read the latest stock inside the same transaction.
export async function savePrepared(sourceId, quantity, batchId = null) {
  const id = batchId || crypto.randomUUID();
  if (db) await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(doc(db, 'posProducts', batchId || sourceId));
    if (!snapshot.exists()) throw new Error('Esta tarjeta o preparación ya no existe.');
    const source = {...snapshot.data(), id: snapshot.id};
    if (batchId ? !source.prepared : source.kind !== 'recipe') throw new Error('La preparación no es válida.');
    const snapshots = await Promise.all(source.ingredients.map(item => transaction.get(doc(db, 'posProducts', item.productId))));
    const products = snapshots.filter(s => s.exists()).map(s => ({...s.data(), id: s.id}));
    const plan = preparationPlan(source, quantity, products, batchId ? source : null);
    plan.updates.forEach(product => transaction.set(doc(db, 'posProducts', product.id), product));
    transaction.set(doc(db, 'posProducts', id), {...plan.product, id});
  });
  else await mutateLocal(state => {
    const source = batchId ? state.products.find(p => p.id === batchId && p.prepared) : state.recipes.find(p => p.id === sourceId);
    if (!source) throw new Error('Esta tarjeta o preparación ya no existe.');
    const plan = preparationPlan(source, quantity, state.products, batchId ? source : null);
    const replacements = new Map(plan.updates.map(product => [product.id, product]));
    replacements.set(id, {...plan.product, id});
    state.products = [...state.products.filter(p => !replacements.has(p.id)), ...replacements.values()];
  });
}
export async function saveOffer(productIds, priceCents, id = crypto.randomUUID(), productQuantities = {}, photo) {
  if (!productIds.length || new Set(productIds).size !== productIds.length || !Number.isSafeInteger(priceCents) || priceCents <= 0) throw new Error('Selecciona productos e ingresa un precio mayor a cero.');
  const offer = {id, kind: 'offer', productIds, priceCents, productQuantities: Object.fromEntries(productIds.map(pid => [pid, productQuantities[pid] ?? 1]))};
  if (photo !== undefined) validateOfferPhoto(photo);
  const attachPhoto = previous => {
    const nextPhoto = photo === undefined ? previous?.photo : photo;
    const result = nextPhoto ? {...offer, photo: nextPhoto} : offer;
    // Leave ample room for Firestore field names, types and document overhead.
    if (new TextEncoder().encode(JSON.stringify(result)).length > 900 * 1024) throw new Error('La tarjeta contiene demasiados datos para guardarse. Reduce los productos o quita la foto.');
    return result;
  };
  const validateQuantities = products => {
    if (!productIds.every(pid => {
      const quantity = offerQuantity(offer, pid);
      return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 1000000000 && (quantity === 1 || products.find(p => p.id === pid)?.prepared);
    })) throw new Error('Solo los preparados permiten varias unidades por combo. Usa cantidades enteras mayores a cero.');
  };
  if (db) await runTransaction(db, async transaction => {
    const existing = await transaction.get(doc(db, 'posProducts', id));
    const retainedIds = existing.exists() ? existing.data().productIds || [] : [];
    const snapshots = await Promise.all(productIds.map(pid => transaction.get(doc(db, 'posProducts', pid))));
    if (!snapshots.every(s => s.exists() && s.data().kind === 'inventory' && (s.data().quantity > 0 || retainedIds.includes(s.id)))) throw new Error('Los productos seleccionados deben estar disponibles.');
    validateQuantities(snapshots.map(s => ({...s.data(), id: s.id})));
    transaction.set(doc(db, 'posProducts', id), attachPhoto(existing.data()));
  });
  else await mutateLocal(state => {
    const index = state.offers.findIndex(p => p.id === id);
    const retainedIds = index >= 0 ? state.offers[index].productIds : [];
    if (!productIds.every(pid => state.products.some(p => p.id === pid && (p.quantity > 0 || retainedIds.includes(pid))))) throw new Error('Los productos seleccionados deben estar disponibles.');
    validateQuantities(state.products);
    const next = attachPhoto(state.offers[index]);
    if (index < 0) state.offers.push(next); else state.offers[index] = next;
  });
}
export async function removeItem(kind, id) {
  if (db) await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(doc(db, 'posProducts', id));
    if (!snapshot.exists()) return;
    const item = snapshot.data();
    if (item.prepared) {
      const snapshots = await Promise.all(item.ingredients.map(ingredient => transaction.get(doc(db, 'posProducts', ingredient.productId))));
      const products = snapshots.filter(s => s.exists()).map(s => ({...s.data(), id: s.id}));
      preparationRefund(item, products).forEach(product => transaction.set(doc(db, 'posProducts', product.id), product));
    }
    transaction.delete(doc(db, 'posProducts', id));
  });
  else await mutateLocal(state => {
    const item = state[kind].find(p => p.id === id);
    if (item?.prepared) {
      const refunds = preparationRefund(item, state.products);
      const ids = new Set(refunds.map(p => p.id));
      state.products = [...state.products.filter(p => !ids.has(p.id)), ...refunds];
    }
    state[kind] = state[kind].filter(p => p.id !== id);
  });
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
      products.forEach(p => transaction.update(doc(db, 'posProducts', p.id), {quantity: p.quantity - offerQuantity(offer, p.id)}));
      transaction.set(doc(db, 'posSales', id), {...sale, id});
    });
  } else await mutateLocal(state => {
    const offer = state.offers.find(o => o.id === offerId);
    if (!offer) throw new Error('Esta opción de venta ya no existe.');
    const sale = prepareSale(offer, state.products, qrCents, cashCents);
    state.products = state.products.map(p => offer.productIds.includes(p.id) ? {...p, quantity: p.quantity - offerQuantity(offer, p.id)} : p);
    state.sales.push({...sale, id});
  });
}

export async function recordCashEntry(amountCents) {
  const entry = {...prepareCashEntry(amountCents), id: CASH_ENTRY_ID};
  if (db) await setDoc(doc(db, 'posSales', entry.id), entry);
  else await mutateLocal(state => {state.sales = [...state.sales.filter(sale => sale.kind !== 'cash-entry'), entry];});
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
