import { useState } from 'react';
import { Check } from 'lucide-react';
import {ROLES, userRole} from '../lib/roles.js';

export default function UserForm({user, currentUser, busy, onClose, onSave}) {
  const [values, setValues] = useState({name: user?.name || '', username: user?.username || '', role: user ? userRole(user) : 'caja', password: '', confirmation: ''});
  const [error, setError] = useState('');
  const change = event => {setValues(current => ({...current, [event.target.name]: event.target.value})); setError('');};
  function submit(event) {
    event.preventDefault();
    if (values.password !== values.confirmation) {setError('Las contraseñas no coinciden.'); return;}
    onSave({name: values.name, username: values.username, role: values.role, password: values.password});
  }
  return <form onSubmit={submit}><fieldset disabled={busy}>
    <label>Nombre<input autoFocus name="name" required maxLength={80} value={values.name} onChange={change} placeholder="Ej. María López" autoComplete="name"/></label>
    <label>Usuario<input name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._\-]{3,40}" value={values.username} onChange={change} placeholder="Ej. maria.lopez" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}/><small className="user-field-help">De 3 a 40 letras, números, puntos o guiones, sin espacios.</small></label>
    <label>{user ? 'Nueva contraseña' : 'Contraseña'}<input name="password" type="password" required={!user} minLength={6} maxLength={200} value={values.password} onChange={change} autoComplete="new-password" placeholder={user ? 'Dejar en blanco para conservarla' : 'Mínimo 6 caracteres'}/></label>
    <label>Confirmar contraseña<input name="confirmation" type="password" required={!user || !!values.password} minLength={6} maxLength={200} value={values.confirmation} onChange={change} autoComplete="new-password"/></label>
    <label>Rol<select name="role" value={values.role} onChange={change} required>{Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="user-field-help">{values.role === 'administrador' ? 'Acceso a todos los módulos y a la gestión de usuarios.' : values.role === 'editor' ? 'Acceso a Cajas e Inventario.' : 'Acceso únicamente a Cajas.'}</small></label>
    {user?.id === currentUser.id && <p className="user-form-note">Si cambias tu contraseña, deberás volver a iniciar sesión.</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary"><Check size={18}/>{busy ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear usuario'}</button></div>
  </fieldset></form>;
}
