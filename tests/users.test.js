import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === './firebase.js' && context.parentURL?.endsWith('/src/lib/users.js')) return {url: 'data:text/javascript,export const db = null;', shortCircuit: true};
  return nextResolve(specifier, context);
}});
const storage = new Map([['plan-b-pos-v1', JSON.stringify({products: [{id: 'keep', name: 'Ron', quantity: 12}], sales: []})]]);
globalThis.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)};
const queues = new Map();
Object.defineProperty(globalThis, 'navigator', {value: {locks: {request(key, update) {
  const pending = (queues.get(key) || Promise.resolve()).catch(() => {}).then(update);
  queues.set(key, pending);
  return pending;
}}}, configurable: true});
globalThis.window = {addEventListener() {}, removeEventListener() {}};
const {initializeUsers, authenticate, saveUser, deleteUser, subscribeUsers, USERS_KEY} = await import('../src/lib/users.js');
const {rememberAccess, readSession, sessionUser, forgetAccess, ACCESS_KEY, validateUser} = await import('../src/lib/access.js');

test('usuarios: persistencia, login, cambios, revocación y eliminación sin tocar el POS', async t => {
  let users;
  const posBefore = storage.get('plan-b-pos-v1');
  await Promise.all([initializeUsers(), initializeUsers()]);
  const stop = subscribeUsers(value => {users = value;}, error => {throw error;});
  await new Promise(resolve => setTimeout(resolve, 0));
  const admin = await authenticate(' ADMIN ', 'admin');
  const session = rememberAccess(admin);
  assert.equal(users.length, 1);
  assert.equal(admin.role, 'administrador');
  assert.ok(users.every(user => !('password' in user)));
  assert.deepEqual(readSession(), session);
  assert.equal(sessionUser(session, users).id, admin.id);
  assert.ok(!storage.get(ACCESS_KEY).includes('admin'));

  await t.test('valida campos y rechaza accesos incorrectos', async () => {
    assert.throws(() => validateUser({name: '', username: 'test', password: 'secret1'}));
    assert.throws(() => validateUser({name: 'Test', username: 'con espacio', password: 'secret1'}));
    assert.throws(() => validateUser({name: 'Test', username: 'test', password: '123'}));
    await assert.rejects(authenticate('admin', 'wrong'), /incorrectos/);
    await assert.rejects(authenticate('unknown', 'admin'), /incorrectos/);
    await assert.rejects(deleteUser(admin, session), /al menos un usuario/);
  });

  let cashier;
  await t.test('crea usuario con hash y sal; detecta nombres duplicados', async () => {
    await saveUser({name: 'Cajera', username: ' Cajera ', password: 'secret1'}, session);
    cashier = await authenticate('CAJERA', 'secret1');
    assert.equal(users.length, 2);
    assert.equal(cashier.username, 'cajera');
    assert.ok(!storage.get(USERS_KEY).includes('secret1'));
    const records = JSON.parse(storage.get(USERS_KEY)).users;
    assert.notEqual(records[0].password.salt, records[1].password.salt);
    await assert.rejects(saveUser({name: 'Duplicado', username: 'CAJERA', password: 'secret2'}, session), /ya está registrado/);
    await assert.rejects(saveUser({name: 'Intruso', username: 'intruso', password: 'secret2'}, {userId: 'fake', version: 'fake'}), /sesión/);
    await assert.rejects(deleteUser(admin, session), /cuenta de tu sesión actual/);
  });

  await t.test('edita nombre y usuario conservando contraseña y detecta formularios desactualizados', async () => {
    const previous = users.find(user => user.id === cashier.id);
    await saveUser({name: 'Caja principal', username: 'caja.principal', password: ''}, session, previous);
    cashier = await authenticate('caja.principal', 'secret1');
    assert.equal(cashier.name, 'Caja principal');
    await assert.rejects(authenticate('cajera', 'secret1'), /incorrectos/);
    await assert.rejects(saveUser({name: 'Cambio viejo', username: 'otro', password: ''}, session, previous), /otra ventana/);
  });

  await t.test('cambiar contraseña invalida las sesiones anteriores', async () => {
    const oldSession = {userId: cashier.id, version: cashier.sessionVersion};
    await saveUser({name: cashier.name, username: cashier.username, password: 'updated1'}, session, cashier);
    assert.equal(sessionUser(oldSession, users), null);
    await assert.rejects(authenticate(cashier.username, 'secret1'), /incorrectos/);
    cashier = await authenticate(cashier.username, 'updated1');
    assert.notEqual(cashier.sessionVersion, oldSession.version);
    await assert.rejects(saveUser({name: 'No válido', username: 'invalido', password: 'secret2'}, oldSession), /sesión/);
  });

  await t.test('roles: restringe gestión, conserva el último administrador y sincroniza cambios', async () => {
    assert.equal(cashier.role, 'caja');
    const cashierSession = {userId: cashier.id, version: cashier.sessionVersion};
    await assert.rejects(saveUser({name: 'Intruso', username: 'intruso', password: 'secret1', role: 'administrador'}, cashierSession), /Solo un administrador/);
    await assert.rejects(saveUser({...cashier, password: '', role: 'administrador'}, cashierSession, cashier), /Solo un administrador/);
    await assert.rejects(deleteUser(users[0], cashierSession), /Solo un administrador/);
    await assert.rejects(saveUser({...users[0], password: '', role: 'editor'}, session, users[0]), /al menos un administrador/);
    await assert.rejects(saveUser({...cashier, password: '', role: 'inventado'}, session, cashier), /rol válido/);
    await saveUser({...cashier, password: '', role: 'editor'}, session, cashier);
    cashier = await authenticate(cashier.username, 'updated1');
    assert.equal(cashier.role, 'editor');
    assert.equal(sessionUser(cashierSession, users).role, 'editor');
    await assert.rejects(saveUser({...cashier, password: '', role: 'administrador'}, cashierSession, cashier), /Solo un administrador/);
    await saveUser({...cashier, password: '', role: 'administrador'}, session, cashier);
    cashier = await authenticate(cashier.username, 'updated1');
    const otherAdminSession = {userId: cashier.id, version: cashier.sessionVersion};
    await saveUser({...users[0], password: '', role: 'caja'}, otherAdminSession, users[0]);
    await assert.rejects(saveUser({...cashier, password: '', role: 'caja'}, session, cashier), /Solo un administrador/);
    await saveUser({...users[0], password: '', role: 'administrador'}, otherAdminSession, users[0]);
    await saveUser({...cashier, password: '', role: 'caja'}, session, cashier);
    cashier = await authenticate(cashier.username, 'updated1');
    assert.equal(cashier.role, 'caja');
  });

  await t.test('eliminar revoca el acceso, no restaura credenciales borradas y conserva inventario', async () => {
    const deletedSession = {userId: cashier.id, version: cashier.sessionVersion};
    await deleteUser(cashier, session);
    assert.equal(sessionUser(deletedSession, users), null);
    await assert.rejects(authenticate(cashier.username, 'updated1'), /incorrectos/);
    await saveUser({name: 'Administración', username: 'administracion', password: 'new-admin'}, session, users[0]);
    await initializeUsers();
    await assert.rejects(authenticate('admin', 'admin'), /incorrectos/);
    assert.equal((await authenticate('administracion', 'new-admin')).name, 'Administración');
    assert.equal(sessionUser(session, users), null);
    assert.equal(storage.get('plan-b-pos-v1'), posBefore);
    forgetAccess();
    assert.equal(readSession(), null);
  });
  stop();
});
