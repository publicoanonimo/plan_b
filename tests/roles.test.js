import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedModules, canOpenModal, isAdministrator} from '../src/lib/roles.js';

test('cada rol solo accede a sus módulos y formularios correspondientes', () => {
  assert.deepEqual(allowedModules({role: 'administrador'}), ['inicio', 'cajas', 'inventario', 'preparar', 'usuarios']);
  assert.deepEqual(allowedModules({role: 'caja'}), ['cajas']);
  assert.deepEqual(allowedModules({role: 'editor'}), ['cajas', 'inventario']);
  for (const role of ['caja', 'editor']) {
    for (const type of ['user', 'delete-user', 'prepared', 'prepare-amount', 'delete-recipe', 'cash-entry', 'close-register']) {
      assert.equal(canOpenModal({role}, type), false, `${role}: ${type}`);
    }
    for (const type of ['offer', 'confirm-offer', 'delete-offer', 'actions-offer', 'payment', 'mixed']) {
      assert.equal(canOpenModal({role}, type), true, `${role}: ${type}`);
    }
  }
  assert.equal(canOpenModal({role: 'caja'}, 'product'), false);
  assert.equal(canOpenModal({role: 'editor'}, 'product'), true);
  assert.equal(canOpenModal({role: 'editor'}, 'delete-product'), true);
  assert.equal(canOpenModal({role: 'administrador'}, 'user'), true);
});

test('las cuentas antiguas conservan acceso; los roles desconocidos no obtienen administración', () => {
  assert.equal(isAdministrator({username: 'anterior'}), true);
  assert.equal(canOpenModal({username: 'anterior'}, 'user'), true);
  assert.deepEqual(allowedModules({role: 'desconocido'}), ['cajas']);
  assert.equal(isAdministrator({role: 'desconocido'}), false);
  assert.equal(canOpenModal({role: 'desconocido'}, 'user'), false);
  assert.equal(canOpenModal({role: 'administrador'}, 'desconocido'), false);
});
