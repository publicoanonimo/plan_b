export const ROLES = {administrador: 'Administrador', caja: 'Caja', editor: 'Editor'};
const MODULES = {
  administrador: ['inicio', 'cajas', 'inventario', 'preparar', 'usuarios'],
  caja: ['cajas'],
  editor: ['cajas', 'inventario'],
};

// Accounts created before roles existed retain their previous access.
export const userRole = user => user?.role === undefined ? 'administrador' : user.role;
export const allowedModules = user => Object.hasOwn(MODULES, userRole(user)) ? MODULES[userRole(user)] : MODULES.caja;
export const isAdministrator = user => userRole(user) === 'administrador';

export function canOpenModal(user, type) {
  const module = {
    user: 'usuarios', 'delete-user': 'usuarios',
    product: 'inventario', 'delete-product': 'inventario', 'actions-product': 'inventario',
    prepared: 'preparar', 'prepare-amount': 'preparar', 'delete-recipe': 'preparar',
    'cash-entry': 'inicio', 'close-register': 'inicio',
    offer: 'cajas', 'confirm-offer': 'cajas', 'delete-offer': 'cajas', 'actions-offer': 'cajas', payment: 'cajas', mixed: 'cajas',
  }[type];
  return !!module && allowedModules(user).includes(module);
}
