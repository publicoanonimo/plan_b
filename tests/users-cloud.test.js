import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {documents, operations} from './helpers/users-firestore.js';
import {hashPassword} from '../src/lib/access.js';
const fixtureURL = new URL('./helpers/users-firestore.js', import.meta.url).href;
registerHooks({resolve(specifier, context, nextResolve) {
  if (new URL(context.parentURL || import.meta.url).pathname.endsWith('/src/lib/users.js') && (specifier === './firebase.js' || specifier === 'firebase/firestore')) return {url: fixtureURL, shortCircuit: true};
  return nextResolve(specifier, context);
}});
const registryPath = 'posProducts/__access_users_v1';

test('Firebase: crear, editar, eliminar y autenticar solo acceden al documento permitido por las reglas existentes', async () => {
  const manager = {id: 'manager', username: 'gerente', name: 'Gerente', password: await hashPassword('original1'), sessionVersion: 'version-1', revision: 1};
  documents.set(registryPath, {kind: 'access-users', users: [manager]});
  documents.set('posProducts/ron', {kind: 'inventory', name: 'Ron', quantity: 12});
  const service = await import('../src/lib/users.js?existing-rules');
  await service.initializeUsers();
  assert.equal(service.getUsersStorage(), 'firebase');
  const account = await service.authenticate('gerente', 'original1');
  assert.equal(account.sessionVersion, 'version-1');
  await assert.rejects(service.authenticate('admin', 'admin'), /incorrectos/);
  const session = {userId: account.id, version: account.sessionVersion};
  const outcomes = await Promise.allSettled([
    service.saveUser({name: 'Caja 1', username: 'cajero', password: 'secret1'}, session),
    service.saveUser({name: 'Caja 2', username: 'CAJERO', password: 'secret2'}, session),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const id = outcomes.find(result => result.status === 'fulfilled').value;
  const saved = documents.get(registryPath).users.find(user => user.id === id);
  assert.equal(saved.username, 'cajero');
  assert.equal(saved.role, 'caja');
  assert.equal(saved.password.algorithm, 'PBKDF2-SHA256');
  assert.ok(!['secret1', 'secret2'].includes(saved.password.hash));
  let users;
  const stop = service.subscribeUsers(value => {users = value;}, error => {throw error;});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(users.length, 2);
  assert.ok(users.every(user => !user.password));
  await service.saveUser({name: 'Cajero actualizado', username: 'cajero', password: ''}, session, users.find(user => user.id === id));
  assert.equal(documents.get(registryPath).users.find(user => user.id === id).password.hash, saved.password.hash);
  await service.saveUser({name: 'Cajero actualizado', username: 'cajero', password: 'updated1'}, session, users.find(user => user.id === id));
  await assert.rejects(service.authenticate('cajero', outcomes[0].status === 'fulfilled' ? 'secret1' : 'secret2'), /incorrectos/);
  assert.equal((await service.authenticate('cajero', 'updated1')).id, id);
  const cashierSession = {userId: id, version: users.find(user => user.id === id).sessionVersion};
  await assert.rejects(service.saveUser({name: 'Intruso', username: 'intruso', password: 'secret1', role: 'administrador'}, cashierSession), /Solo un administrador/);
  await assert.rejects(service.deleteUser(account, cashierSession), /Solo un administrador/);
  await assert.rejects(service.saveUser({name: account.name, username: account.username, password: '', role: 'editor'}, session, account), /al menos un administrador/);
  await service.saveUser({name: 'Editor', username: 'cajero', password: '', role: 'editor'}, session, users.find(user => user.id === id));
  assert.equal((await service.authenticate('cajero', 'updated1')).role, 'editor');
  await service.deleteUser(users.find(user => user.id === id), session);
  await assert.rejects(service.authenticate('cajero', 'updated1'), /incorrectos/);
  assert.equal(documents.get(registryPath).users.length, 1);
  assert.deepEqual(documents.get('posProducts/ron'), {kind: 'inventory', name: 'Ron', quantity: 12});
  assert.ok(operations.length > 0);
  assert.ok(operations.every(path => path === registryPath));
  assert.deepEqual([...documents.keys()].sort(), [registryPath, 'posProducts/ron'].sort());
  stop();
});

test('Firebase: inicializa una sola cuenta en posProducts sin sobrescribir registros existentes', async () => {
  documents.clear(); operations.length = 0;
  const service = await import('../src/lib/users.js?bootstrap-existing-rules');
  await Promise.all([service.initializeUsers(), service.initializeUsers()]);
  const admin = await service.authenticate('admin', 'admin');
  assert.equal(admin.name, 'Administrador');
  const before = structuredClone(documents.get(registryPath));
  await service.initializeUsers();
  assert.deepEqual(documents.get(registryPath), before);
  assert.deepEqual([...documents.keys()], [registryPath]);
  assert.ok(operations.every(path => path === registryPath));
});
