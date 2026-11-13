import {doc, getDocFromServer, onSnapshot, runTransaction} from 'firebase/firestore';
import {db} from './firebase.js';
import {hashPassword, verifyPassword, validateUser, sessionUser} from './access.js';
import {isAdministrator, userRole} from './roles.js';

export const USERS_KEY = 'plan-b-users-v1';
// User accounts share the existing posProducts permissions and are excluded from inventory.
const registryRef = () => doc(db, 'posProducts', '__access_users_v1');
const listeners = new Set();
const publicUser = ({password, ...user}) => user;
const publish = registry => { for (const next of listeners) next(registry.users.map(publicUser)); };
let initialization;
export const getUsersStorage = () => db ? 'firebase' : 'local';
function readLocal() {
  const saved = localStorage.getItem(USERS_KEY);
  return saved ? JSON.parse(saved) : null;
}
async function localMutation(change) {
  const update = () => {
    const registry = readLocal();
    const result = change(registry);
    localStorage.setItem(USERS_KEY, JSON.stringify(registry));
    publish(registry);
    return result;
  };
  return navigator.locks ? navigator.locks.request(USERS_KEY, update) : update();
}
async function mutation(change) {
  if (!db) return localMutation(change);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(registryRef());
    if (!snapshot.exists()) throw new Error('No se encontró el registro de usuarios. Recarga la página.');
    const registry = snapshot.data();
    const result = change(registry);
    if (new TextEncoder().encode(JSON.stringify(registry)).length > 900 * 1024) throw new Error('Se alcanzó la capacidad del registro de usuarios.');
    transaction.set(registryRef(), registry);
    return result;
  });
}

async function createInitialRegistry() {
  const timestamp = new Date().toISOString();
  return {kind: 'access-users', users: [{id: crypto.randomUUID(), name: 'Administrador', username: 'admin', role: 'administrador', password: await hashPassword('admin'), sessionVersion: crypto.randomUUID(), revision: 1, createdAt: timestamp, updatedAt: timestamp}]};
}

export function initializeUsers() {
  initialization ??= (async () => {
    if (!db) {
      if (readLocal()) return;
      const initial = await createInitialRegistry();
      const create = () => { if (!readLocal()) localStorage.setItem(USERS_KEY, JSON.stringify(initial)); };
      if (navigator.locks) await navigator.locks.request(USERS_KEY, create); else create();
      return;
    }
    if ((await getDocFromServer(registryRef())).exists()) return;
    const initial = await createInitialRegistry();
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(registryRef());
      if (!snapshot.exists()) transaction.set(registryRef(), initial);
    });
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

export function subscribeUsers(next, fail) {
  let stopped = false;
  let cleanup = () => {};
  initializeUsers().then(() => {
    if (stopped) return;
    if (db) {
      cleanup = onSnapshot(registryRef(), snapshot => {
        if (!snapshot.exists() || !Array.isArray(snapshot.data().users)) { fail(new Error('El registro de usuarios no está disponible.')); return; }
        next(snapshot.data().users.map(publicUser));
      }, fail);
    } else {
      const refresh = () => { try { const registry = readLocal(); if (!Array.isArray(registry?.users)) throw new Error('No se pudo leer el registro de usuarios.'); next(registry.users.map(publicUser)); } catch (error) { fail(error); } };
      const sync = event => { if (event.key === USERS_KEY || event.key === null) refresh(); };
      listeners.add(next);
      window.addEventListener('storage', sync);
      refresh();
      cleanup = () => {listeners.delete(next); window.removeEventListener('storage', sync);};
    }
  }).catch(error => { if (!stopped) fail(error); });
  return () => {stopped = true; cleanup();};
}

export async function authenticate(username, password) {
  await initializeUsers();
  const registry = db ? (await getDocFromServer(registryRef())).data() : readLocal();
  const user = registry?.users.find(item => item.username === username.trim().toLowerCase());
  if (!user || !await verifyPassword(password, user.password)) throw new Error('Usuario o contraseña incorrectos.');
  return publicUser(user);
}

function requireSession(session, registry) {
  const actor = sessionUser(session, registry?.users || []);
  if (!actor) throw new Error('Tu sesión ya no está vigente. Vuelve a iniciar sesión.');
  if (!isAdministrator(actor)) throw new Error('Solo un administrador puede gestionar usuarios.');
}

export async function saveUser(values, session, previous = null) {
  const fields = validateUser({...values, role: values.role ?? (previous ? userRole(previous) : 'caja')}, !previous);
  const password = values.password ? await hashPassword(values.password) : null;
  const id = previous?.id || crypto.randomUUID();
  const version = crypto.randomUUID();
  return mutation(registry => {
    requireSession(session, registry);
    if (registry.users.some(user => user.id !== id && user.username === fields.username)) throw new Error('Ese nombre de usuario ya está registrado.');
    const index = registry.users.findIndex(user => user.id === id);
    const timestamp = new Date().toISOString();
    if (previous) {
      if (index < 0) throw new Error('Este usuario ya fue eliminado.');
      if (registry.users[index].revision !== previous.revision) throw new Error('El usuario cambió en otra ventana. Cierra el formulario y vuelve a editarlo.');
      if (isAdministrator(registry.users[index]) && fields.role !== 'administrador' && registry.users.filter(isAdministrator).length <= 1) throw new Error('Debe quedar al menos un administrador.');
      registry.users[index] = {...registry.users[index], ...fields, ...(password ? {password, sessionVersion: version} : {}), revision: previous.revision + 1, updatedAt: timestamp};
    } else registry.users.push({id, ...fields, password, sessionVersion: version, revision: 1, createdAt: timestamp, updatedAt: timestamp});
    return id;
  });
}

export async function deleteUser(user, session) {
  return mutation(registry => {
    requireSession(session, registry);
    if (registry.users.length <= 1) throw new Error('Debe quedar al menos un usuario para iniciar sesión.');
    if (user.id === session.userId) throw new Error('No puedes eliminar la cuenta de tu sesión actual.');
    const existing = registry.users.find(item => item.id === user.id);
    if (!existing) throw new Error('Este usuario ya fue eliminado.');
    if (existing.revision !== user.revision) throw new Error('El usuario cambió en otra ventana. Vuelve a seleccionarlo.');
    if (isAdministrator(existing) && registry.users.filter(isAdministrator).length <= 1) throw new Error('Debe quedar al menos un administrador.');
    registry.users = registry.users.filter(item => item.id !== user.id);
  });
}
