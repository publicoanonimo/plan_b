import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LogIn, RefreshCw } from 'lucide-react';
import { ACCESS_KEY, readSession, sessionUser, forgetAccess, rememberAccess } from '../lib/access.js';
import { authenticate, subscribeUsers, getUsersStorage } from '../lib/users.js';

const ProtectedApp = lazy(() => import('../App.jsx'));
function AccessWindow({children}) {
  return <div className="access-page"><section className="access-card" aria-label="Acceso a PLAN B"><h1>𓆩PLAN B𓆪</h1>{children}</section></div>;
}

export default function AuthGate() {
  const [session, setSession] = useState(readSession);
  const [users, setUsers] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registryError, setRegistryError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    setRegistryError('');
    return subscribeUsers(next => {setUsers(next); setRegistryError('');}, () => setRegistryError('No se pudieron cargar los usuarios. Comprueba la conexión y vuelve a intentar.'));
  }, [attempt]);
  useEffect(() => {
    const syncAccess = event => { if (event.key === ACCESS_KEY || event.key === null) setSession(readSession()); };
    window.addEventListener('storage', syncAccess);
    return () => window.removeEventListener('storage', syncAccess);
  }, []);
  useEffect(() => {
    if (users && session && !sessionUser(session, users)) {
      forgetAccess(); setSession(null); setPassword('');
      setError('Tu cuenta cambió o fue eliminada. Vuelve a iniciar sesión.');
    }
  }, [users, session]);

  async function login(event) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const user = await authenticate(username, password);
      setUsers(current => [...(current || []).filter(item => item.id !== user.id), user]);
      setSession(rememberAccess(user)); setPassword('');
    } catch (error) {
      setError(error.message === 'Usuario o contraseña incorrectos.' ? error.message : 'No se pudo iniciar sesión. Comprueba la conexión y vuelve a intentar.');
    } finally {busyRef.current = false; setBusy(false);}
  }
  function logout() {
    forgetAccess(); setSession(null); setUsername(''); setPassword(''); setError('');
  }

  if (registryError) return <AccessWindow><p className="error-banner" role="alert">{registryError}</p><button className="button secondary" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18}/>Reintentar</button></AccessWindow>;
  if (!users) return <AccessWindow><p className="access-status" role="status">Cargando usuarios…</p></AccessWindow>;
  const currentUser = sessionUser(session, users);
  if (currentUser) return <Suspense fallback={<AccessWindow><p className="access-status" role="status">Cargando…</p></AccessWindow>}><ProtectedApp onSignOut={logout} users={users} currentUser={currentUser} session={session} usersStorage={getUsersStorage()}/></Suspense>;
  return <AccessWindow><h2>Iniciar sesión</h2><form className="access-form" onSubmit={login}><fieldset disabled={busy}>
    <label>Usuario<input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={40} value={username} onChange={event => setUsername(event.target.value)} autoFocus/></label>
    <label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)}/></label>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <button className="button primary access-submit" type="submit"><LogIn size={20}/>{busy ? 'Ingresando…' : 'Ingresar'}</button>
  </fieldset></form></AccessWindow>;
}
