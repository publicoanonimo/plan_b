export const toCents = value => Math.round(Number(value) * 100);
const wholeMoney = new Intl.NumberFormat('es-BO', {minimumFractionDigits: 0, maximumFractionDigits: 2});
const fractionalMoney = new Intl.NumberFormat('es-BO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
export const money = cents => (cents % 100 === 0 ? wholeMoney : fractionalMoney).format(cents / 100);
export function validateProduct(name, quantity) {
  if (!name?.trim() || name.trim().length > 80) throw new Error('Escribe un nombre de entre 1 y 80 caracteres.');
  if (String(quantity).trim() === '' || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 0) throw new Error('La cantidad debe ser un número entero igual o mayor a cero.');
}
export function validatePayment(priceCents, qrCents, cashCents) {
  if (![priceCents, qrCents, cashCents].every(Number.isSafeInteger) || priceCents <= 0 || qrCents < 0 || cashCents < 0 || qrCents + cashCents !== priceCents) throw new Error('Los montos QR y efectivo deben sumar exactamente el precio de la venta.');
}
export function prepareInventoryBatch(data, products) {
  validateProduct(data.name, data.quantity);
  if (Number(data.quantity) <= 0) throw new Error('La cantidad de unidades preparadas debe ser mayor a cero.');
  if (!Array.isArray(data.ingredients) || !data.ingredients.length) throw new Error('Selecciona al menos un producto para el preparado.');
  if (new Set(data.ingredients.map(item => item.productId)).size !== data.ingredients.length) throw new Error('No repitas un producto en el preparado.');
  const ingredients = data.ingredients.map(item => {
    const product = products.find(p => p.id === item.productId && p.kind === 'inventory');
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Cada descuento debe ser una cantidad entera mayor a cero.');
    if (!product) throw new Error('Uno de los productos seleccionados ya no existe.');
    if (product.quantity < quantity) throw new Error(`Existencias insuficientes de ${product.name}. Disponibles: ${product.quantity}.`);
    return {productId: product.id, name: product.name, quantity};
  });
  return {kind: 'inventory', name: data.name.trim(), quantity: Number(data.quantity), prepared: true, preparedQuantity: Number(data.quantity), ingredients};
}
// Recipes describe one batch and do not require available stock until preparation.
export function prepareRecipe(data, products) {
  validateProduct(data.name, data.quantity);
  if (Number(data.quantity) <= 0 || Number(data.quantity) > 1000000000) throw new Error('La cantidad base debe ser de 1 a 1.000.000.000 unidades.');
  if (!Array.isArray(data.ingredients) || !data.ingredients.length) throw new Error('Selecciona al menos un producto.');
  if (new Set(data.ingredients.map(item => item.productId)).size !== data.ingredients.length) throw new Error('No repitas ingredientes.');
  const ingredients = data.ingredients.map(item => {
    const product = products.find(p => p.id === item.productId && p.kind === 'inventory');
    const quantity = Number(item.quantity);
    if (!product) throw new Error('Uno de los ingredientes ya no existe. Edita la tarjeta.');
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000000) throw new Error('Cada ingrediente debe tener una cantidad entera mayor a cero y de hasta 1.000.000.000.');
    return {productId: product.id, name: product.name, quantity};
  });
  return {kind: 'recipe', name: data.name.trim(), quantity: Number(data.quantity), ingredients};
}

export function preparationPlan(source, quantity, products, previous = null) {
  const baseQuantity = previous?.baseQuantity ?? previous?.preparedQuantity ?? source.quantity;
  const baseIngredients = previous?.baseIngredients ?? previous?.ingredients ?? source.ingredients;
  const target = Number(quantity);
  if (!Number.isSafeInteger(target) || target < baseQuantity || target > 1000000000 || target % baseQuantity !== 0) throw new Error(`Prepara múltiplos de ${baseQuantity}, con un mínimo de ${baseQuantity} unidades.`);
  const used = previous ? previous.preparedQuantity - previous.quantity : 0;
  if (target < used) throw new Error(`Ya se utilizaron ${used} unidades. No puedes reducir la preparación por debajo de esa cantidad.`);
  const ingredients = baseIngredients.map(item => ({...item, quantity: item.quantity * (target / baseQuantity)}));
  const updates = ingredientUpdates(ingredients, previous?.ingredients || [], products);
  const product = {kind: 'inventory', name: previous?.name ?? source.name, quantity: target - used, prepared: true, preparedQuantity: target, baseQuantity, baseIngredients, ingredients};
  if (previous?.recipeId || source.id) product.recipeId = previous?.recipeId || source.id;
  return {product, updates};
}

function ingredientUpdates(next, previous, products) {
  const ids = new Set([...next, ...previous].map(item => item.productId));
  return [...ids].map(id => {
    const before = previous.find(item => item.productId === id);
    const after = next.find(item => item.productId === id);
    const product = products.find(p => p.id === id && p.kind === 'inventory');
    const delta = (before?.quantity || 0) - (after?.quantity || 0);
    if (!product && delta <= 0) throw new Error(`El ingrediente ${after?.name || before?.name} ya no existe. Edita la receta o repón el producto.`);
    const quantity = (product?.quantity || 0) + delta;
    if (quantity < 0) throw new Error(`Existencias insuficientes de ${product.name}. Disponibles: ${product.quantity}.`);
    if (!Number.isSafeInteger(quantity)) throw new Error('La cantidad calculada supera el límite permitido.');
    return {...(product || {id, kind: 'inventory', name: before.name}), quantity};
  });
}

export function preparationRefund(product, products) {
  return ingredientUpdates([], product.ingredients || [], products);
}

export function offerQuantity(offer, id) { return offer.productQuantities?.[id] ?? 1; }
export function offerProductName(offer, id, products) {
  const product = products.find(p => p.id === id);
  const quantity = offerQuantity(offer, id);
  return `${product?.prepared || quantity > 1 ? `${quantity} × ` : ''}${product?.name || 'Producto eliminado'}`;
}
export function saleName(offer, products) { return offer.productIds.map(id => offerProductName(offer, id, products)).join(' + '); }
export function isAvailable(offer, products) { return offer.productIds.length > 0 && offer.productIds.every(id => {
  const quantity = offerQuantity(offer, id);
  return Number.isSafeInteger(quantity) && quantity > 0 && products.some(p => p.id === id && p.quantity >= quantity);
}); }
export function prepareSale(offer, products, qrCents, cashCents) {
  validatePayment(offer.priceCents, qrCents, cashCents);
  if (!isAvailable(offer, products)) throw new Error('Uno de los productos está agotado, no tiene existencias suficientes para el combo o fue eliminado. Actualiza el inventario.');
  return {name: saleName(offer, products), offerId: offer.id, productIds: offer.productIds, productQuantities: Object.fromEntries(offer.productIds.map(id => [id, offerQuantity(offer, id)])), totalCents: offer.priceCents, qrCents, cashCents, payment: qrCents && cashCents ? 'QR + Efectivo' : qrCents ? 'QR' : 'Efectivo', time: registrationTime()};
}
export function totals(sales) { return sales.filter(sale => sale.kind !== 'cash-entry').reduce((sum, sale) => ({qr: sum.qr + sale.qrCents, cash: sum.cash + sale.cashCents, total: sum.total + sale.totalCents}), {qr: 0, cash: 0, total: cashEntryTotal(sales)}); }

export const CASH_ENTRY_ID = 'register-cash';
export function prepareCashEntry(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 10000000000) throw new Error('Ingresa un monto igual o mayor a cero y de hasta Bs 100.000.000.');
  return {kind: 'cash-entry', name: 'Monto de caja', productIds: [], totalCents: amountCents, qrCents: 0, cashCents: 0, payment: 'Caja', time: registrationTime()};
}
function currentCashEntry(sales) {
  const entries = sales.filter(sale => sale.kind === 'cash-entry');
  return entries.find(sale => sale.id === CASH_ENTRY_ID) || sortedSales(entries)[0];
}
export function cashEntryTotal(sales) {
  return currentCashEntry(sales)?.totalCents ?? 0;
}
export function registerSales(sales) {
  const entry = currentCashEntry(sales);
  return [...sales.filter(sale => sale.kind !== 'cash-entry'), ...(entry ? [{...entry, cashCents: 0, qrCents: 0, payment: 'Caja'}] : [])];
}

export function registrationTime(date = new Date()) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map(part => String(part).padStart(2, '0')).join(':');
}
export function saleTime(sale) {
  if (typeof sale.time === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(sale.time)) return sale.time;
  const legacy = new Date(sale.createdAt);
  return Number.isNaN(legacy.getTime()) ? '—' : registrationTime(legacy);
}
export function sortedSales(sales, now = new Date()) {
  const seconds = value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const current = seconds(registrationTime(now));
  const age = sale => (current - seconds(saleTime(sale)) + 86400) % 86400;
  return [...sales].reverse().sort((a, b) => age(a) - age(b));
}

export function groupOffers(offers, products = []) {
  const productsById = new Map(products.map(product => [product.id, product]));
  const groups = [
    {id: 'preparados', name: 'Preparados', offers: []},
    {id: 'botellas', name: 'Combo de botellas', offers: []},
    {id: 'otros', name: 'Otros combos', offers: []},
    {id: 'unitarios', name: 'Unitarios', offers: []},
  ];
  offers.forEach(offer => {
    const prepared = offer.productIds.some(id => {
      const product = productsById.get(id);
      return product?.prepared || /\b(jarras?|mezclables?|mesclables?)\b/i.test(product?.name || '');
    });
    const group = prepared ? 'preparados' : offer.productIds.length === 2 ? 'botellas' : offer.productIds.length === 1 ? 'unitarios' : 'otros';
    groups.find(item => item.id === group).offers.push(offer);
  });
  groups.forEach(group => group.offers.sort((a, b) => a.priceCents - b.priceCents));
  return groups.filter(group => group.id !== 'otros' || group.offers.length > 0);
}
