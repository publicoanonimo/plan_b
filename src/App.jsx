import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Check, ChevronRight, LockKeyhole, CircleDollarSign, Download, LayoutDashboard, Package, Plus, QrCode, Trash2, Pencil, LogOut, Wine, X, CheckCircle2, Users } from 'lucide-react';
import Modal from './components/Modal.jsx';
import PreparedForm from './components/PreparedForm.jsx';
import PreparationAmount from './components/PreparationAmount.jsx';
import SalesCatalog from './components/SalesCatalog.jsx';
import OfferPhotoField from './components/OfferPhotoField.jsx';
import UsersModule from './components/UsersModule.jsx';
import UserForm from './components/UserForm.jsx';
import {saveUser, deleteUser} from './lib/users.js';
import {allowedModules, canOpenModal, userRole} from './lib/roles.js';
import { compressOfferPhoto } from './lib/offerPhoto.js';
import { subscribe, saveProduct, savePrepared, saveRecipe, saveOffer, removeItem, recordSale, recordCashEntry, closeRegister } from './lib/store.js';
import { money, saleName, toCents, totals, saleTime, sortedSales, cashEntryTotal, registerSales } from './lib/domain.js';
const modules = {inicio: 'Inicio', cajas: 'Cajas', inventario: 'Inventario', preparar: 'Preparar bebidas', usuarios: 'Usuarios'};
const icons = {inicio: LayoutDashboard, cajas: Banknote, inventario: Package, preparar: Wine, usuarios: Users};
export default function App({onSignOut, users, currentUser, session, usersStorage}) {
  const [requestedPage, setPage] = useState('inicio');
  const permittedModules = allowedModules(currentUser);
  const page = permittedModules.includes(requestedPage) ? requestedPage : permittedModules[0];
  const includeSales = permittedModules.includes('inicio');
  const [data, setData] = useState({products: [], offers: [], sales: [], recipes: []});
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [pendingModal, setModal] = useState(null);
  const modal = pendingModal && canOpenModal(currentUser, pendingModal.type) ? pendingModal : null;
  const role = userRole(currentUser);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => {setModal(null); setError(''); setToast('');}, [role]);
  useEffect(() => {
    setLoading(true);
    return subscribe(value => {setData(value); setLoading(false); setConnectionError('');}, e => {setConnectionError(`No se pudo cargar la información: ${e.message}`); setLoading(false);}, {includeSales});
  }, [includeSales]);
  useEffect(() => {if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer);}, [toast]);
  const sales = useMemo(() => page === 'inicio' ? sortedSales(registerSales(data.sales)) : [], [data.sales, page]);
  const sum = useMemo(() => totals(sales), [sales]);
  const openSaleModal = useCallback((type, item) => {
    if (!canOpenModal(currentUser, type)) return;
    setError(''); setModal({type, item}); setForm({qr: '', cash: ''});
  }, [currentUser]);

  function navigate(next) {if (permittedModules.includes(next)) {setPage(next); setModal(null); setError('');}}
  function open(type, item) {
    if (!canOpenModal(currentUser, type)) return;
    setError(''); setModal({type, item});
    setForm(type === 'product' ? {name: item?.name || '', quantity: item?.quantity ?? ''} : type === 'offer' ? {productIds: item?.productIds || [], productQuantities: item?.productQuantities || {}, photo: item?.photo || null, price: item ? String(item.priceCents / 100) : ''} : type === 'cash-entry' ? {amount: String(cashEntryTotal(data.sales) / 100)} : {qr: '', cash: ''});
  }
  async function run(action, message, close = true) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {await action(); if (close) setModal(null); setToast(message);} catch (e) {setError(e.message || 'No se pudo completar la operación.');} finally {busyRef.current = false; setBusy(false);}
  }
  const change = e => setForm({...form, [e.target.name]: e.target.value});
  function submit(e) {
    e.preventDefault();
    if (modal.type === 'product') run(() => saveProduct(form, modal.item?.id), modal.item ? 'Producto actualizado' : 'Producto registrado');
    if (modal.type === 'offer') {
      if (modal.item) { setModal({...modal, type: 'confirm-offer'}); return; }
      run(() => saveOffer(form.productIds, toCents(form.price), modal.item?.id, form.productQuantities, form.photo), 'Tarjeta de venta guardada');
    }
    if (modal.type === 'cash-entry') run(() => recordCashEntry(toCents(form.amount)), 'Monto de caja actualizado');
    if (modal.type === 'mixed') run(() => recordSale(modal.item.id, toCents(form.qr), toCents(form.cash), modal.item), 'Venta registrada correctamente');
  }
  const stats = [{label: 'Total QR', value: sum.qr, className: 'purple'}, {label: 'Total efectivo', value: sum.cash, className: 'green'}, {label: 'Total de caja', value: sum.total, className: 'gold'}];
  const editableProducts = data.products.filter(p => p.quantity > 0 || modal?.item?.productIds?.includes(p.id));
  const missingProductIds = form.productIds?.filter(id => !data.products.some(p => p.id === id)) || [];
  return <div className="app-shell">
    <div className="workspace">
    <header className={`topbar${page !== 'inicio' ? ' topbar-with-action' : ''}${page === 'inventario' ? ' topbar-inventory' : ''}`}>
      <div className="brand"><h1>𓆩PLAN B𓆪</h1></div>
      {page !== 'inicio' && <button type="button" className="icon-button header-role-sign-out" aria-label="Cerrar sesión" title="Cerrar sesión" disabled={busy} onClick={() => run(onSignOut, 'Sesión cerrada')}><LogOut size={20}/></button>}
      {page === 'usuarios' ? <button className="button primary header-create-button" disabled={busy} onClick={() => open('user')}><Plus size={20}/><span>Crear usuario</span></button> : page === 'inventario' ? <div className="inventory-header-actions"><button className="button primary header-create-button" disabled={loading || busy} onClick={() => open('product')}><Plus size={20}/><span>Registrar producto</span></button></div> : page === 'preparar' ? <button className="button primary header-create-button" disabled={loading || busy || !!connectionError} onClick={() => open('prepared')}><Plus size={20}/><span>Preparados</span></button> : page === 'cajas' ? <button className="button primary header-create-button" disabled={loading || busy} onClick={() => open('offer')}><Plus size={20}/><span>Añadir producto a la venta</span></button> : <button type="button" className="button btn-action-danger header-sign-out" aria-label="Cerrar sesión" disabled={busy} onClick={() => run(onSignOut, 'Sesión cerrada')}><LogOut size={19} aria-hidden="true"/><span>Salir</span></button>}
    </header>
    <main><div className="page-heading"><h2 className="module-title">{modules[page]}</h2>{page === 'inicio' && <div className="heading-actions"><button className="button secondary btn-action-outline" onClick={() => run(async () => {const {exportReport} = await import('./lib/report.js'); await exportReport(sales);}, 'PDF descargado', false)} disabled={busy || loading}><Download size={18}/>Exportar PDF</button><button className="button btn-action-danger" onClick={() => open('close-register', data.sales.map(s => s.id))} disabled={busy || loading || !!connectionError}><LockKeyhole size={17}/>Cerrar cajas</button></div>}</div>
    {connectionError && <div className="error-banner" role="alert">{connectionError}</div>}
    {error && !modal && <div className="error-banner" role="alert">{error}</div>}
    {page === 'inicio' ? <>
      <section className="stats-grid" aria-label="Totales de ventas"><button type="button" className="stat-card blue cash-entry-card" disabled={loading || busy || !!connectionError} onClick={() => open('cash-entry')} aria-haspopup="dialog"><div className="stat-top"><span>Caja</span></div><div className="stat-value"><span>Bs</span> {money(cashEntryTotal(sales))}</div><span className="cash-entry-hint"><Plus size={17}/>Actualizar monto</span></button>{stats.map(({label, value, className}) => <article key={label} className={`stat-card ${className}`}><div className="stat-top"><span>{label}</span></div><div className="stat-value"><span>Bs</span> {money(value)}</div></article>)}</section>
      <section className="activity sales-list panel" aria-label="Ventas registradas"><div className="panel-heading sales-list-title"><h2>Ventas</h2><span>{sales.length} movimientos</span></div>
      <div className="sales-list-heading" aria-hidden="true"><span>Producto / combinación</span><span>Monto</span><span>Método de pago</span><span>Hora</span></div>
      <ul className="sales-rows">{sales.map(s => <li className="sales-row" key={s.id}>
        <div className="sales-product"><span className="sales-row-icon" aria-hidden="true">{s.payment === 'Caja' ? <CircleDollarSign size={19}/> : <Wine size={19}/>}</span><h3>{s.name}</h3></div>
        <div className="sales-amount"><span className="sr-only">Monto: </span><small>Bs</small> {money(s.totalCents)}</div>
        <div className="sales-payment"><span className={`payment-badge ${s.payment === 'QR' ? 'qr' : s.payment === 'Efectivo' ? 'cash' : s.payment === 'Caja' ? 'register' : 'mixed'}`}>{s.payment === 'QR' ? <QrCode size={13}/> : s.payment === 'Caja' ? <CircleDollarSign size={13}/> : <Banknote size={13}/>} {s.payment}</span>{s.payment === 'QR + Efectivo' && <small className="sales-split">QR {money(s.qrCents)} · Ef. {money(s.cashCents)}</small>}</div>
        <div className="sales-time"><span className="sr-only">Hora: </span>{saleTime(s)}</div>
      </li>)}</ul>
      {!sales.length && <p className="empty-state">{loading ? 'Cargando…' : 'Sin ventas registradas'}</p>}
      </section>
    </> : page === 'usuarios' ? <UsersModule storage={usersStorage} users={users} currentUser={currentUser} busy={busy} onEdit={user => open('user', user)} onDelete={user => open('delete-user', user)}/> : loading ? <p className="empty-state">Cargando…</p> : page === 'inventario' ? <section className="inventory-list panel" aria-label="Productos de inventario">
      <div className="inventory-list-heading" aria-hidden="true"><span>Producto</span><span>Unidades</span><span>Acciones</span></div>
      <ul className="inventory-rows">{[...data.products].sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'es')).map(product => <li key={product.id} className={`inventory-row ${product.quantity === 0 ? 'sold-out' : ''}`}>
        <div className="inventory-product"><h3>{product.name}</h3><span className={`stock-badge ${product.quantity === 0 ? 'out' : ''}`}><span/>{product.quantity > 0 ? 'Disponible' : 'Agotado'}</span>{product.prepared && <details className="preparation-details"><summary>Preparado · Ver detalles</summary><p>Unidades elaboradas: {product.preparedQuantity}</p><ul>{product.ingredients.map((ingredient, index) => <li key={index}>{ingredient.name}: {ingredient.quantity} uds. utilizadas</li>)}</ul></details>}</div>
        <div className="inventory-stock"><strong>{product.quantity}</strong><span>unidades</span></div>
        <div className="inventory-actions">
          <button className="icon-button" disabled={busy || (product.prepared && !permittedModules.includes('preparar'))} aria-label={`Editar ${product.name}`} title="Editar producto" onClick={() => {if (product.prepared) {navigate('preparar'); open('prepare-amount', product);} else open('product', product);}}><Pencil size={19}/></button>
          <button className="icon-button inventory-delete" disabled={busy} aria-label={`Eliminar ${product.name}`} title="Eliminar producto" onClick={() => open('delete-product', product)}><Trash2 size={19}/></button>
        </div>
      </li>)}</ul>
      {!data.products.length && <p className="empty-state">Sin productos registrados</p>}
    </section> : page === 'preparar' ? <section aria-label="Tarjetas para preparar bebidas">
      <div className="product-grid recipe-grid">{data.recipes.map(recipe => <article className="product-card recipe-card" key={recipe.id}>
        <button className="recipe-trigger" disabled={busy || !!connectionError} onClick={() => open('prepare-amount', recipe)} aria-label={`Preparar ${recipe.name}`}><h3>{recipe.name}</h3><ul className="recipe-ingredients">{recipe.ingredients.map(ingredient => <li key={ingredient.productId}>{ingredient.name}: <strong>{ingredient.quantity} uds.</strong></li>)}</ul></button>
        <div className="recipe-actions"><button className="icon-button" disabled={busy} aria-label={`Editar receta ${recipe.name}`} onClick={() => open('prepared', recipe)}><Pencil size={19}/></button><button className="icon-button inventory-delete" disabled={busy} aria-label={`Eliminar receta ${recipe.name}`} onClick={() => open('delete-recipe', recipe)}><Trash2 size={19}/></button></div>
      </article>)}</div>
      {!data.recipes.length && <p className="empty-state">Crea una tarjeta con el botón Preparados.</p>}
    </section> : <SalesCatalog offers={data.offers} products={data.products} busy={busy} onOpen={openSaleModal}/>}
    </main></div>
    <nav className="module-waybar" aria-label="Módulos" style={{gridTemplateColumns: `repeat(${permittedModules.length}, minmax(0, 1fr))`}}>
      {Object.entries(icons).filter(([key]) => permittedModules.includes(key)).map(([key, Icon]) => <button type="button" key={key} className={`waybar-button${page === key ? ' active' : ''}`} aria-label={modules[key]} title={modules[key]} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={23} aria-hidden="true"/><span>{modules[key]}</span></button>)}
    </nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button className="icon-button" aria-label="Cerrar notificación" onClick={() => setToast('')}><X size={16}/></button></div>}
    {modal && <Modal busy={busy} onClose={() => setModal(null)} title={{user: modal.item ? 'Editar usuario' : 'Crear usuario', 'delete-user': '¿Eliminar usuario?', prepared: modal.item ? 'Editar tarjeta de preparación' : 'Crear tarjeta de preparación', 'prepare-amount': `¿Cuántas ${modal.item?.name} desea preparar?`, 'delete-recipe': '¿Eliminar tarjeta de preparación?', 'cash-entry': 'Actualizar monto de caja', product: modal.item ? 'Editar producto' : 'Registrar producto', offer: modal.item ? 'Editar tarjeta de venta' : 'Añadir producto a la venta', payment: 'Registrar una venta', mixed: 'Efectivo + QR', 'actions-product': modal.item?.name, 'actions-offer': modal.item?.productIds ? saleName(modal.item, data.products) : '', 'close-register': '¿Está seguro de cerrar cajas?', 'confirm-offer': '¿Guardar cambios?', 'delete-product': '¿Eliminar producto?', 'delete-offer': '¿Eliminar tarjeta de venta?'}[modal.type]} subtitle={modal.type === 'payment' || modal.type === 'mixed' ? `${saleName(modal.item, data.products)} · Bs ${money(modal.item.priceCents)}` : undefined}>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {modal.type === 'user' && <UserForm key={modal.item?.id || 'new-user'} user={modal.item} currentUser={currentUser} busy={busy} onClose={() => setModal(null)} onSave={values => run(() => saveUser(values, session, modal.item), modal.item ? 'Usuario actualizado' : 'Usuario creado')}/>}
      {modal.type === 'delete-user' && <><p className="delete-copy">Eliminarás el acceso de <strong>{modal.item.name} ({modal.item.username})</strong>. Sus sesiones se cerrarán.</p><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button type="button" className="button delete-button" disabled={busy} onClick={() => run(() => deleteUser(modal.item, session), 'Usuario eliminado')}><Trash2 size={18}/>{busy ? 'Eliminando…' : 'Eliminar usuario'}</button></div></>}
      {modal.type === 'prepared' && <PreparedForm key={modal.item?.id || 'new'} recipe={modal.item} products={data.products} busy={busy} onClose={() => setModal(null)} onSave={values => run(() => saveRecipe(values, modal.item?.id), 'Tarjeta de preparación guardada')}/>}
      {modal.type === 'prepare-amount' && <PreparationAmount key={modal.item.id} item={modal.item} busy={busy} onClose={() => setModal(null)} onSave={quantity => run(() => savePrepared(modal.item.recipeId || modal.item.id, quantity, modal.item.prepared ? modal.item.id : null), 'Preparación guardada y existencias actualizadas')}/>}
      {(modal.type === 'product' || modal.type === 'offer' || modal.type === 'mixed' || modal.type === 'cash-entry') && <form onSubmit={submit}><fieldset disabled={busy}>
        {modal.type === 'cash-entry' && <label>Monto de caja (Bs)<input autoFocus name="amount" type="number" required min="0" max="100000000" step="0.01" value={form.amount} onChange={change} placeholder="0"/></label>}
        {modal.type === 'product' && <><label>Nombre del producto<input autoFocus name="name" maxLength={80} required value={form.name} onChange={change} placeholder="Ej. Ron añejo"/></label><label>Cantidad de unidades<div className="quantity-control"><button type="button" aria-label="Disminuir cantidad" disabled={Number(form.quantity) <= 0} onClick={() => setForm({...form, quantity: Math.max(0, Number(form.quantity || 0) - 1)})}>−</button><input name="quantity" type="number" min="0" max="1000000000" step="1" required value={form.quantity} onChange={change} placeholder="0"/><button type="button" aria-label="Aumentar cantidad" disabled={Number(form.quantity) >= 1000000000} onClick={() => setForm({...form, quantity: Number(form.quantity || 0) + 1})}>+</button></div></label></>}
        {modal.type === 'offer' && <><label>Selecciona uno o más productos</label><div className="product-options">{editableProducts.map(p => {
          const selected = form.productIds.includes(p.id);
          const quantity = form.productQuantities[p.id] ?? 1;
          return <div className={`offer-product-option ${selected ? 'checked' : ''}`} key={p.id}>
            <label className="checkbox-option"><input type="checkbox" checked={selected} onChange={() => setForm({...form, productIds: selected ? form.productIds.filter(id => id !== p.id) : [...form.productIds, p.id]})}/><span>{p.name}</span><small>{p.quantity > 0 ? `${p.quantity} uds.` : 'Agotado'}</small></label>
            {p.prepared && <div className="offer-quantity"><span>Unidades por combo</span><div className="offer-quantity-buttons"><button type="button" aria-label={`Disminuir unidades de ${p.name}`} disabled={!selected || quantity <= 1} onClick={() => setForm({...form, productQuantities: {...form.productQuantities, [p.id]: quantity - 1}})}>−</button><output aria-label={`Unidades de ${p.name}`} aria-live="polite">{quantity}</output><button type="button" aria-label={`Aumentar unidades de ${p.name}`} disabled={!selected || quantity >= 1000000000} onClick={() => setForm({...form, productQuantities: {...form.productQuantities, [p.id]: quantity + 1}})}>+</button></div></div>}
          </div>;
        })}{missingProductIds.map(id => <label className="checkbox-option missing-option" key={id}><input type="checkbox" checked onChange={() => setForm({...form, productIds: form.productIds.filter(pid => pid !== id)})}/><span>Producto eliminado</span></label>)}{!editableProducts.length && !missingProductIds.length && <p className="muted">Sin productos disponibles</p>}</div>{form.productIds.length > 0 && <div className="combo-preview"><span>NOMBRE DE LA TARJETA</span><strong>{saleName(form, data.products)}</strong></div>}<label>Precio de venta (Bs)<input required name="price" type="number" min="0.01" max="100000000" step="0.01" placeholder="0" value={form.price} onChange={change}/></label><OfferPhotoField photo={form.photo} onSelect={file => run(async () => {const photo = await compressOfferPhoto(file); setForm(current => ({...current, photo}));}, 'Foto lista para guardar', false)} onRemove={() => setForm(current => ({...current, photo: null}))}/></>}
        {modal.type === 'mixed' && <><label>Monto QR (Bs)<input autoFocus name="qr" type="number" required min="0.01" step="0.01" max={modal.item.priceCents / 100} value={form.qr} onChange={change} placeholder="0"/></label><label>Monto efectivo (Bs)<input name="cash" type="number" required min="0.01" step="0.01" max={modal.item.priceCents / 100} value={form.cash} onChange={change} placeholder="0"/></label><div className={`payment-remainder ${toCents(form.qr || 0) + toCents(form.cash || 0) === modal.item.priceCents ? 'balanced' : ''}`}><span>Restante por distribuir</span><strong>Bs {money(modal.item.priceCents - toCents(form.qr || 0) - toCents(form.cash || 0))}</strong></div></>}
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" type="submit" disabled={modal.type === 'offer' && (!form.productIds.length || missingProductIds.length > 0)}><Check size={16}/>{busy ? 'Guardando…' : modal.type === 'cash-entry' ? 'Guardar monto' : modal.type === 'product' ? modal.item ? 'Guardar cambios' : 'Registrar producto' : modal.type === 'mixed' ? 'Registrar venta' : 'Guardar tarjeta'}</button></div>
      </fieldset></form>}
      {modal.type === 'payment' && <div className="payment-options"><button disabled={busy} onClick={() => run(() => recordSale(modal.item.id, modal.item.priceCents, 0, modal.item), 'Venta QR registrada')}><span className="payment-option-icon qr"><QrCode size={25}/></span><span><strong>QR</strong></span><ChevronRight size={18}/></button><button disabled={busy} onClick={() => run(() => recordSale(modal.item.id, 0, modal.item.priceCents, modal.item), 'Venta en efectivo registrada')}><span className="payment-option-icon cash"><Banknote size={25}/></span><span><strong>Efectivo</strong></span><ChevronRight size={18}/></button><button disabled={busy} onClick={() => open('mixed', modal.item)}><span className="payment-option-icon mixed"><CircleDollarSign size={25}/></span><span><strong>Efectivo + QR</strong></span><ChevronRight size={18}/></button></div>}
      {modal.type.startsWith('delete') && modal.type !== 'delete-user' && <><p className="delete-copy">Eliminarás <strong>{modal.type === 'delete-product' || modal.type === 'delete-recipe' ? modal.item.name : saleName(modal.item, data.products)}</strong>.{modal.item.prepared && ' Se devolverán a inventario todos los ingredientes utilizados en esta preparación.'}{modal.type === 'delete-recipe' && ' Las bebidas ya preparadas se conservarán en inventario.'}</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button className="button delete-button" disabled={busy} onClick={() => run(() => removeItem(modal.type === 'delete-product' ? 'products' : modal.type === 'delete-recipe' ? 'recipes' : 'offers', modal.item.id), 'Eliminado correctamente')}><Trash2 size={16}/>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button></div></>}
      {modal.type === 'confirm-offer' && <><div className="edit-summary">{form.photo && <img className="offer-photo-preview" src={form.photo} alt="Foto de la tarjeta a guardar"/>}<strong>{saleName(form, data.products)}</strong><span>Bs {money(toCents(form.price))}</span></div><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal({...modal, type: 'offer'})}>Volver</button><button className="button primary" disabled={busy} onClick={() => run(() => saveOffer(form.productIds, toCents(form.price), modal.item.id, form.productQuantities, form.photo), 'Tarjeta actualizada')}><Check size={17}/>{busy ? 'Guardando…' : 'Confirmar cambios'}</button></div></>}
      {modal.type === 'close-register' && <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button className="button close-register-button" disabled={busy} onClick={() => run(() => closeRegister(modal.item), 'Cajas cerradas')}><Check size={17}/>{busy ? 'Cerrando…' : 'Aceptar'}</button></div>}
      {(modal.type === 'actions-product' || modal.type === 'actions-offer') && <div className="card-options-actions"><button className="button primary" onClick={() => open(modal.type === 'actions-product' ? 'product' : 'offer', modal.item)}><Pencil size={20}/>Editar</button><button className="button delete-button" onClick={() => open(modal.type === 'actions-product' ? 'delete-product' : 'delete-offer', modal.item)}><Trash2 size={20}/>Borrar</button></div>}
    </Modal>}
  </div>;
}
