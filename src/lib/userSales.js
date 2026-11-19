import {isSuperUser, visibleUsers} from './roles.js';

export function userSalesSummary(users, sales) {
  const byUser = new Map(visibleUsers(users).map(user => [user.id, {id: user.id, name: user.name, totalCents: 0}]));
  let unassignedCents = 0;
  for (const sale of sales) {
    if (sale.kind === 'cash-entry' || isSuperUser({id: sale.userId})) continue;
    if (!sale.userId) {unassignedCents += sale.totalCents; continue;}
    if (!byUser.has(sale.userId)) byUser.set(sale.userId, {id: sale.userId, name: sale.userName || 'Usuario eliminado', totalCents: 0});
    byUser.get(sale.userId).totalCents += sale.totalCents;
  }
  const rows = [...byUser.values()];
  const max = Math.max(0, ...rows.map(row => row.totalCents));
  const min = rows.length ? Math.min(...rows.map(row => row.totalCents)) : 0;
  return {rows: rows.map(row => ({...row,
    percent: max > 0 ? row.totalCents / max * 100 : 0,
    hue: row.totalCents === 0 ? 0 : max === min ? 120 : (row.totalCents - min) / (max - min) * 120,
  })), unassignedCents};
}
