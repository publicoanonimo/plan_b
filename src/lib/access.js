export const ACCESS_KEY = 'plan-b-device-access-v1';
export const ACCESS_VALUE = 'remembered';

export function credentialsMatch(username, password) {
  return username === 'admin' && password === 'admin';
}

export function hasRememberedAccess() {
  try { return localStorage.getItem(ACCESS_KEY) === ACCESS_VALUE; }
  catch { return false; }
}

export function rememberAccess() {
  try { localStorage.setItem(ACCESS_KEY, ACCESS_VALUE); }
  catch { /* Access still works for this visit when storage is unavailable. */ }
}

export function forgetAccess() {
  try { localStorage.removeItem(ACCESS_KEY); }
  catch { /* The current interface is closed even if storage is unavailable. */ }
}
