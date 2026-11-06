import { lazy, Suspense, useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { ACCESS_KEY, credentialsMatch, forgetAccess, hasRememberedAccess, rememberAccess } from '../lib/access.js';

const ProtectedApp = lazy(() => import('../App.jsx'));

function AccessWindow({children}) {
  return <div className="access-page"><section className="access-card" aria-label="Acceso a PLAN B"><img className="access-logo" src="/plan-b-logo.jpeg" alt="Logo PLAN B"/><h1>PLAN B</h1>{children}</section></div>;
}

export default function AuthGate() {
  const [accepted, setAccepted] = useState(hasRememberedAccess);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const syncAccess = event => {
      if (event.key === ACCESS_KEY || event.key === null) setAccepted(hasRememberedAccess());
    };
    window.addEventListener('storage', syncAccess);
    return () => window.removeEventListener('storage', syncAccess);
  }, []);

  function login(event) {
    event.preventDefault();
    if (!credentialsMatch(username, password)) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    rememberAccess();
    setPassword(''); setError(''); setAccepted(true);
  }

  function logout() {
    forgetAccess();
    setAccepted(false); setUsername(''); setPassword(''); setError('');
  }

  if (accepted) return <Suspense fallback={<AccessWindow><p className="access-status" role="status">Cargando…</p></AccessWindow>}><ProtectedApp onSignOut={logout}/></Suspense>;
  return <AccessWindow><h2>Iniciar sesión</h2><form className="access-form" onSubmit={login}>
    <label>Usuario<input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} autoFocus/></label>
    <label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)}/></label>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <button className="button primary access-submit" type="submit"><LogIn size={20}/>Ingresar</button>
  </form></AccessWindow>;
}
