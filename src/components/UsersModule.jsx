import { UserRound, Pencil, Trash2 } from 'lucide-react';
import {ROLES, userRole, isAdministrator} from '../lib/roles.js';

export default function UsersModule({storage, users, currentUser, busy, onEdit, onDelete}) {
  return <><div className="users-storage-status"><span className="stock-badge"><span/>{storage === 'local' ? 'Este navegador' : 'Guardado en Firebase'}</span></div>
    <section className="inventory-list users-list panel" aria-label="Usuarios de acceso">
    <div className="inventory-list-heading users-list-heading" aria-hidden="true"><span>Nombre</span><span>Usuario</span><span>Acciones</span></div>
    <ul className="inventory-rows">{[...users].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(user => {
      const isCurrent = user.id === currentUser.id;
      const cannotDelete = isCurrent || users.length <= 1 || (isAdministrator(user) && users.filter(isAdministrator).length <= 1);
      return <li className="inventory-row user-row" key={user.id}>
        <div className="user-identity"><span className="sales-row-icon" aria-hidden="true"><UserRound size={19}/></span><div className="inventory-product"><h3>{user.name}</h3>{isCurrent && <span className="stock-badge"><span/>Tu cuenta</span>}</div></div>
        <div className="user-username">{user.username}<small className="user-role">{ROLES[userRole(user)] || 'Caja'}</small></div>
        <div className="inventory-actions"><button type="button" className="icon-button" aria-label={`Editar usuario ${user.username}`} title="Editar usuario" disabled={busy} onClick={() => onEdit(user)}><Pencil size={19}/></button><button type="button" className="icon-button inventory-delete" aria-label={`Eliminar usuario ${user.username}`} title={isCurrent ? 'No puedes eliminar tu cuenta actual' : users.length <= 1 ? 'Debe quedar al menos un usuario' : 'Eliminar usuario'} disabled={busy || cannotDelete} onClick={() => onDelete(user)}><Trash2 size={19}/></button></div>
      </li>;
    })}</ul>
  </section></>;
}
