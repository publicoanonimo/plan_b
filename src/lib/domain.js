export const toCents = value => Math.round(Number(value) * 100);
export const money = cents => new Intl.NumberFormat('es-BO', {minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2}).format(cents / 100);
export function validateProduct(name, quantity) {
  if (!name?.trim() || name.trim().length > 80) throw new Error('Escribe un nombre de entre 1 y 80 caracteres.');
  if (String(quantity).trim() === '' || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 0) throw new Error('La cantidad debe ser un número entero igual o mayor a cero.');
}
export function validatePayment(priceCents, qrCents, cashCents) {
  if (![priceCents, qrCents, cashCents].every(Number.isSafeInteger) || priceCents <= 0 || qrCents < 0 || cashCents < 0 || qrCents + cashCents !== priceCents) throw new Error('Los montos QR y efectivo deben sumar exactamente el precio de la venta.');
}
export function saleName(offer, products) { return offer.productIds.map(id => products.find(p => p.id === id)?.name || 'Producto eliminado').join(' + '); }
export function isAvailable(offer, products) { return offer.productIds.length > 0 && offer.productIds.every(id => products.some(p => p.id === id && p.quantity > 0)); }
export function prepareSale(offer, products, qrCents, cashCents) {
  validatePayment(offer.priceCents, qrCents, cashCents);
  if (!isAvailable(offer, products)) throw new Error('Uno de los productos está agotado o fue eliminado. Actualiza el inventario.');
  return {name: saleName(offer, products), offerId: offer.id, productIds: offer.productIds, totalCents: offer.priceCents, qrCents, cashCents, payment: qrCents && cashCents ? 'QR + Efectivo' : qrCents ? 'QR' : 'Efectivo', time: registrationTime()};
}
export function totals(sales) { return sales.reduce((sum, sale) => ({qr: sum.qr + sale.qrCents, cash: sum.cash + sale.cashCents, total: sum.total + sale.totalCents}), {qr: 0, cash: 0, total: 0}); }

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

export function groupOffers(offers) {
  const groups = new Map([[1, []], [2, []], [3, []]]);
  offers.forEach(offer => {
    const count = offer.productIds.length;
    if (!groups.has(count)) groups.set(count, []);
    groups.get(count).push(offer);
  });
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([count, items]) => ({count, offers: items}));
}
