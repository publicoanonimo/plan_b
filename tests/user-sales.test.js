import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPER_USER_ID} from '../src/lib/roles.js';
import {userSalesSummary} from '../src/lib/userSales.js';
const users = [{id: 'a', name: 'Ana'}, {id: 'b', name: 'Bruno'}, {id: 'c', name: 'Carla'}];

test('cada usuario empieza en cero rojo y el cierre reinicia los acumulados', () => {
  const {rows} = userSalesSummary(users, []);
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.totalCents === 0 && row.percent === 0 && row.hue === 0));
  assert.deepEqual(userSalesSummary([], []), {rows: [], unassignedCents: 0});
});

test('suma QR, efectivo y mixtos por id, excluye caja y compara rojo, amarillo y verde', () => {
  const sales = [
    {userId: 'a', totalCents: 1000, payment: 'QR'},
    {userId: 'a', totalCents: 1000, payment: 'Efectivo'},
    {userId: 'b', totalCents: 4000, payment: 'QR + Efectivo'},
    {userId: 'c', totalCents: 6000},
    {userId: 'c', kind: 'cash-entry', totalCents: 100000},
    {totalCents: 800},
  ];
  const {rows, unassignedCents} = userSalesSummary(users, sales);
  assert.deepEqual(rows.map(row => row.totalCents), [2000, 4000, 6000]);
  assert.deepEqual(rows.map(row => row.hue), [0, 60, 120]);
  rows.forEach((row, index) => assert.ok(Math.abs(row.percent - [100 / 3, 200 / 3, 100][index]) < 1e-10));
  assert.equal(unassignedCents, 800);
});

test('cambiar nombres no divide ventas y las cuentas eliminadas conservan su acumulado', () => {
  const result = userSalesSummary([{id: 'a', name: 'Ana nueva'}], [
    {userId: 'a', userName: 'Ana anterior', totalCents: 2500},
    {userId: 'deleted', userName: 'Ana anterior', totalCents: 1200},
  ]);
  assert.deepEqual(result.rows.map(({id, name, totalCents}) => ({id, name, totalCents})), [
    {id: 'a', name: 'Ana nueva', totalCents: 2500},
    {id: 'deleted', name: 'Ana anterior', totalCents: 1200},
  ]);
});

test('los usuarios empatados comparten altura y color; los empates positivos son verdes', () => {
  const {rows} = userSalesSummary(users.slice(0, 2), [{userId: 'a', totalCents: 1200}, {userId: 'b', totalCents: 1200}]);
  assert.ok(rows.every(row => row.percent === 100 && row.hue === 120));
});

test('el super usuario no aparece ni altera escala o colores aunque tenga ventas', () => {
  const sales = [{userId: 'a', totalCents: 1000}, {userId: 'b', totalCents: 2000}];
  const expected = userSalesSummary(users, sales);
  const hiddenSale = {userId: SUPER_USER_ID, userName: 'Super usuario', totalCents: 900000};
  assert.deepEqual(userSalesSummary([...users, {id: SUPER_USER_ID, name: 'Super usuario'}], [...sales, hiddenSale]), expected);
  assert.deepEqual(userSalesSummary(users, [...sales, hiddenSale]), expected);
});
