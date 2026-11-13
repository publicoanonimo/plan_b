import {ROLES} from './roles.js';

export const ACCESS_KEY = 'plan-b-device-access-v2';
export const LEGACY_ACCESS_KEY = 'plan-b-device-access-v1';
const ITERATIONS = 600000;
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/.{2}/g) || [], byte => parseInt(byte, 16));

export function validateUser({name, username, password, role = 'caja'}, requirePassword = true) {
  if (!name?.trim() || name.trim().length > 80) throw new Error('Escribe un nombre de entre 1 y 80 caracteres.');
  if (!/^[a-z0-9._-]{3,40}$/i.test(username?.trim() || '')) throw new Error('El usuario debe tener entre 3 y 40 letras, números, puntos, guiones o guiones bajos.');
  if ((requirePassword || password) && (typeof password !== 'string' || password.length < 6 || password.length > 200 || !password.trim())) throw new Error('La contraseña debe tener entre 6 y 200 caracteres.');
  if (!Object.hasOwn(ROLES, role)) throw new Error('Selecciona un rol válido.');
  return {name: name.trim(), username: username.trim().toLowerCase(), role};
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS}, key, 256);
  return {algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: hex(salt), hash: hex(new Uint8Array(bits))};
}

export async function verifyPassword(password, record) {
  if (typeof password !== 'string' || password.length > 200 || record?.algorithm !== 'PBKDF2-SHA256' || record.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: unhex(record.salt), iterations: record.iterations}, key, 256));
  const expected = unhex(record.hash);
  let different = 0;
  bits.forEach((byte, index) => { different |= byte ^ expected[index]; });
  return different === 0;
}

export function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(ACCESS_KEY));
    return typeof session?.userId === 'string' && typeof session?.version === 'string' ? session : null;
  } catch { return null; }
}

export function rememberAccess(user) {
  const session = {userId: user.id, version: user.sessionVersion};
  try { localStorage.setItem(ACCESS_KEY, JSON.stringify(session)); localStorage.removeItem(LEGACY_ACCESS_KEY); }
  catch { /* The session still works in memory if remembering it is unavailable. */ }
  return session;
}

export function sessionUser(session, users) {
  return session ? users.find(user => user.id === session.userId && user.sessionVersion === session.version) || null : null;
}

export function forgetAccess() {
  try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(LEGACY_ACCESS_KEY); }
  catch { /* Closing the current session still works without persistent storage. */ }
}
