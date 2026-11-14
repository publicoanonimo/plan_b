// Isolated Firestore double: optimistic transaction retries and incremental queries.
export const db = {};
export const cloudEnabled = true;
export const documents = new Map();
const versions = new Map();
export const trace = [];
export const subscriptions = [];
export const dataCalls = new Map();
export const controls = {beforeCommit: null, commitError: null, readLatencyMs: 0, commitLatencyMs: 0};
const listeners = new Set();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export const doc = (_db, ...parts) => ({path: parts.join('/')});
export const collection = doc;
export const where = (field, operator, value) => ({field, operator, value});
export const query = (reference, filter) => ({...reference, filter});
export function put(path, data) {
  if (data === undefined) documents.delete(path);
  else documents.set(path, structuredClone(data));
  versions.set(path, (versions.get(path) || 0) + 1);
}
function snapshot(path, data = documents.get(path)) {
  const saved = structuredClone(data);
  return {id: path.split('/').at(-1), exists: () => saved !== undefined, data() {
    dataCalls.set(path, (dataCalls.get(path) || 0) + 1);
    return structuredClone(saved);
  }};
}
export function emit() {for (const deliver of listeners) deliver();}
export function onSnapshot(reference, next, fail) {
  const subscription = {reference, stopped: false};
  subscriptions.push(subscription);
  let seen = new Map();
  const deliver = () => {
    if (subscription.stopped) return;
    try {
      const current = new Map([...documents].filter(([path, value]) => path.startsWith(reference.path + '/') && (!reference.filter || reference.filter.value.includes(value[reference.filter.field]))));
      const changes = [];
      for (const [path, value] of current) {
        if (!seen.has(path) || seen.get(path).version !== versions.get(path)) changes.push({type: seen.has(path) ? 'modified' : 'added', doc: snapshot(path, value)});
      }
      for (const [path, value] of seen) if (!current.has(path)) changes.push({type: 'removed', doc: snapshot(path, value.data)});
      seen = new Map([...current].map(([path, value]) => [path, {version: versions.get(path), data: structuredClone(value)}]));
      next({docChanges: () => changes, get docs() {throw new Error('Full collection decoding is unnecessary for incremental updates.');}});
    } catch (error) {fail(error);}
  };
  listeners.add(deliver);
  queueMicrotask(deliver);
  return () => {subscription.stopped = true; listeners.delete(deliver);};
}
export async function runTransaction(_db, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reads = new Map();
    const writes = [];
    trace.push({type: 'attempt', attempt});
    const transaction = {
      async get(reference) {
        if (writes.length) throw new Error('All reads must happen before writes.');
        trace.push({type: 'read-start', path: reference.path, attempt});
        await pause(controls.readLatencyMs);
        reads.set(reference.path, versions.get(reference.path));
        trace.push({type: 'read-end', path: reference.path, attempt});
        return snapshot(reference.path);
      },
      update(reference, fields) {writes.push({path: reference.path, fields});},
      set(reference, data) {writes.push({path: reference.path, data});},
      delete(reference) {writes.push({path: reference.path, data: undefined});},
    };
    const result = await change(transaction);
    if (controls.beforeCommit) {const hook = controls.beforeCommit; controls.beforeCommit = null; await hook();}
    await pause(controls.commitLatencyMs);
    if ([...reads].some(([path, version]) => versions.get(path) !== version)) continue;
    if (controls.commitError) throw controls.commitError;
    for (const write of writes) put(write.path, write.fields ? {...documents.get(write.path), ...write.fields} : write.data);
    emit();
    trace.push({type: 'commit', attempt});
    return result;
  }
  throw new Error('Too much contention.');
}
export async function setDoc(reference, data) {put(reference.path, data); emit();}
export function writeBatch() {
  const paths = [];
  return {delete(reference) {paths.push(reference.path);}, async commit() {paths.forEach(path => put(path)); emit();}};
}
export function reset() {
  if (listeners.size) throw new Error('A test left an active listener.');
  documents.clear(); versions.clear(); trace.length = 0; subscriptions.length = 0; dataCalls.clear();
  Object.assign(controls, {beforeCommit: null, commitError: null, readLatencyMs: 0, commitLatencyMs: 0});
}
