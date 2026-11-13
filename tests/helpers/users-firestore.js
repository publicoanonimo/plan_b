// Firestore contract constrained to the user's existing posProducts permissions.
export const db = {};
export const documents = new Map();
export const operations = [];
const listeners = new Set();
let queue = Promise.resolve();
export const doc = (_db, ...parts) => ({path: parts.join('/')});
const snapshot = reference => ({id: reference.path.split('/').at(-1), exists: () => documents.has(reference.path), data: () => structuredClone(documents.get(reference.path))});
const check = reference => {
  operations.push(reference.path);
  if (!/^posProducts\/[^/]+$/.test(reference.path)) throw Object.assign(new Error('Permission denied'), {code: 'permission-denied'});
};
export async function getDocFromServer(reference) {check(reference); return snapshot(reference);}
export function onSnapshot(reference, next, fail) {
  const deliver = () => {try {check(reference); next(snapshot(reference));} catch (error) {fail(error);}};
  listeners.add(deliver); queueMicrotask(deliver);
  return () => listeners.delete(deliver);
}
export function runTransaction(_db, change) {
  const execute = async () => {
    const writes = [];
    const transaction = {
      async get(reference) {check(reference); return snapshot(reference);},
      set(reference, data) {check(reference); writes.push(() => documents.set(reference.path, structuredClone(data)));},
    };
    const result = await change(transaction);
    writes.forEach(write => write());
    for (const deliver of listeners) deliver();
    return result;
  };
  const result = queue.catch(() => {}).then(execute); queue = result;
  return result;
}
