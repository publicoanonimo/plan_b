import { useEffect, useRef, useState } from 'react';
import { Banknote, Check, ChevronRight, LockKeyhole, CircleDollarSign, Download, LayoutDashboard, Package, Plus, QrCode, Trash2, Pencil, MoreVertical, LogOut, Wine, X, CheckCircle2 } from 'lucide-react';
import Modal from './components/Modal.jsx';
import PreparedForm from './components/PreparedForm.jsx';
import PreparationAmount from './components/PreparationAmount.jsx';
import ModuleDrawer from './components/ModuleDrawer.jsx';
import SaleTitle from './components/SaleTitle.jsx';
import OfferPhotoField from './components/OfferPhotoField.jsx';
import { compressOfferPhoto } from './lib/offerPhoto.js';
import { subscribe, saveProduct, savePrepared, saveRecipe, saveOffer, removeItem, recordSale, recordCashEntry, closeRegister } from './lib/store.js';
import { isAvailable, money, saleName, toCents, totals, saleTime, sortedSales, groupOffers, cashEntryTotal, registerSales } from './lib/domain.js';
const modules = {inicio: 'Inicio', cajas: 'Cajas', inventario: 'Inventario', preparar: 'Preparar bebidas'};
const icons = {inicio: LayoutDashboard, cajas: Banknote, inventario: Package, preparar: Wine};
export default function App({onSignOut}) {
  const [page, setPage] = useState('inicio');
  const [data, setData] = useState({products: [], offers: [], sales: [], recipes: []});
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({});
  useEffect(() => subscribe(value => {setData(value); setLoading(false); setConnectionError('');}, e => {setConnectionError(`No se pudo cargar la información: ${e.message}`); setLoading(false);}), []);
  useEffect(() => {if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer);}, [toast]);
  const sales = sortedSales(registerSales(data.sales));
  const sum = totals(sales);

  function navigate(next) {setPage(next); setMenuOpen(false);}
  function open(type, item) {
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
    if (modal.type === 'mixed') run(() => recordSale(modal.item.id, toCents(form.qr), toCents(form.cash)), 'Venta registrada correctamente');
  }
  const stats = [{label: 'Total QR', value: sum.qr, className: 'purple'}, {label: 'Total efectivo', value: sum.cash, className: 'green'}, {label: 'Total de caja', value: sum.total, className: 'gold'}];
  const offerGroups = groupOffers(data.offers, data.products);
  const editableProducts = data.products.filter(p => p.quantity > 0 || modal?.item?.productIds?.includes(p.id));
  const missingProductIds = form.productIds?.filter(id => !data.products.some(p => p.id === id)) || [];
  return <div className="app-shell">
    <div className="workspace">
    <header className={`topbar${page !== 'inicio' ? ' topbar-with-action' : ''}${page === 'inventario' ? ' topbar-inventory' : ''}`}>
      <div className="brand"><button className="logo-toggle" aria-label="Abrir módulos" aria-expanded={menuOpen} aria-controls={menuOpen ? 'module-navigation' : undefined} onClick={() => setMenuOpen(true)}><img className="brand-logo" src="/plan-b-logo.jpeg" alt="Logo PLAN B"/></button><h1>PLAN B</h1></div>
      {page === 'inventario' ? <div className="inventory-header-actions"><button className="button primary header-create-button" disabled={loading || busy} onClick={() => open('product')}><Plus size={20}/><span>Registrar producto</span></button></div> : page === 'preparar' ? <button className="button primary header-create-button" disabled={loading || busy || !!connectionError} onClick={() => open('prepared')}><Plus size={20}/><span>Preparados</span></button> : page === 'cajas' ? <button className="button primary header-create-button" disabled={loading || busy} onClick={() => open('offer')}><Plus size={20}/><span>Añadir producto a la venta</span></button> : <div className="header-ornament" aria-hidden="true"><span/><i/><span/></div>}
    </header>
    <main><div className="page-heading"><h2 className="module-title">{modules[page]}</h2>{page === 'inicio' && <div className="heading-actions"><button className="button secondary" onClick={() => run(async () => {const {exportReport} = await import('./lib/report.js'); await exportReport(sales);}, 'PDF descargado', false)} disabled={busy || loading}><Download size={18}/>Exportar PDF</button><button className="button secondary" onClick={() => open('close-register', data.sales.map(s => s.id))} disabled={busy || loading || !!connectionError}><LockKeyhole size={17}/>Cerrar cajas</button></div>}</div>
    {connectionError && <div className="error-banner" role="alert">{connectionError}</div>}
    {error && !modal && <div className="error-banner" role="alert">{error}</div>}
    {page === 'inicio' ? <>
      <section className="stats-grid" aria-label="Totales de ventas"><button type="button" className="stat-card blue cash-entry-card" disabled={loading || busy || !!connectionError} onClick={() => open('cash-entry')} aria-haspopup="dialog"><div className="stat-top"><span>Caja</span></div><div className="stat-value"><span>Bs</span> {money(cashEntryTotal(sales))}</div><span className="cash-entry-hint"><Plus size={17}/>Actualizar monto</span></button>{stats.map(({label, value, className}) => <article key={label} className={`stat-card ${className}`}><div className="stat-top"><span>{label}</span></div><div className="stat-value"><span>Bs</span> {money(value)}</div></article>)}</section>
      <section className="activity panel"><div className="panel-heading"><h2>Ventas</h2></div>
      <div className="table-scroll"><table aria-label="Ventas registradas"><thead><tr><th scope="col">PRODUCTO / COMBINACIÓN</th><th scope="col">MONTO</th><th scope="col">MÉTODO DE PAGO</th><th scope="col">HORA</th></tr></thead><tbody>{sales.map(s => <tr key={s.id}><td data-label="Producto"><div className="sale-name"><span className="row-icon"><Wine size={17}/></span><span>{s.name}</span></div></td><td className="amount" data-label="Monto">Bs {money(s.totalCents)}</td><td data-label="Método de pago"><span className={`payment-badge ${s.payment === 'QR' ? 'qr' : s.payment === 'Efectivo' ? 'cash' : 'mixed'}`}>{s.payment === 'QR' ? <QrCode size={12}/> : <Banknote size={12}/>} {s.payment}</span>{s.payment === 'QR + Efectivo' && <small className="split-detail">QR {money(s.qrCents)} · Ef. {money(s.cashCents)}</small>}</td><td className="time-cell" data-label="Hora">{saleTime(s)}</td></tr>)}</tbody></table></div>
      {!sales.length && <p className="empty-state">{loading ? 'Cargando…' : 'Sin ventas registradas'}</p>}
      </section>
    </> : loading ? <p className="empty-state">Cargando…</p> : page === 'inventario' ? <section className="inventory-list panel" aria-label="Productos de inventario">
      <div className="inventory-list-heading" aria-hidden="true"><span>Producto</span><span>Unidades</span><span>Acciones</span></div>
      <ul className="inventory-rows">{[...data.products].sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'es')).map(product => <li key={product.id} className={`inventory-row ${product.quantity === 0 ? 'sold-out' : ''}`}>
        <div className="inventory-product"><h3>{product.name}</h3><span className={`stock-badge ${product.quantity === 0 ? 'out' : ''}`}><span/>{product.quantity > 0 ? 'Disponible' : 'Agotado'}</span>{product.prepared && <details className="preparation-details"><summary>Preparado · Ver detalles</summary><p>Unidades elaboradas: {product.preparedQuantity}</p><ul>{product.ingredients.map((ingredient, index) => <li key={index}>{ingredient.name}: {ingredient.quantity} uds. utilizadas</li>)}</ul></details>}</div>
        <div className="inventory-stock"><strong>{product.quantity}</strong><span>unidades</span></div>
        <div className="inventory-actions">
          <button className="icon-button" disabled={busy} aria-label={`Editar ${product.name}`} title="Editar producto" onClick={() => {if (product.prepared) {navigate('preparar'); open('prepare-amount', product);} else open('product', product);}}><Pencil size={19}/></button>
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
    </section> : <div className="sales-catalog">
      {offerGroups.map(group => <section key={group.id} className="sale-group panel" aria-labelledby={`sale-group-${group.id}`}>
        <h3 id={`sale-group-${group.id}`}>{group.name}</h3>
        {group.offers.length > 0 && <div className="product-grid">{group.offers.map(offer => {
          const usable = isAvailable(offer, data.products);
          return <article key={offer.id} className={`product-card sale-card ${!usable ? 'sold-out' : ''}`}>
            <button className="sale-trigger" disabled={!usable || busy} onClick={() => open('payment', offer)} aria-label={`Registrar venta de ${saleName(offer, data.products)}`}>
              <div className="card-upper"><div className="card-meta"><span><Wine size={15}/> VENTA</span><span className={`stock-badge ${!usable ? 'out' : ''}`}><span/>{usable ? 'Disponible' : 'Agotado'}</span></div><SaleTitle offer={offer} products={data.products}/>{offer.photo && <img className="sale-photo" src={offer.photo} alt="" loading="lazy" decoding="async"/>}</div>
              <div className="card-lower"><div className="sale-price"><small>Bs</small> {money(offer.priceCents)}</div></div>
            </button>
            <button className="icon-button card-options" aria-label={`Opciones de ${saleName(offer, data.products)}`} aria-haspopup="dialog" onClick={() => open('actions-offer', offer)}><MoreVertical size={23}/></button>
          </article>;
        })}</div>}
        {!group.offers.length && <p className="empty-state">Sin tarjetas en este contenedor</p>}
      </section>)}
    </div>}
    </main></div>
    {menuOpen && <ModuleDrawer onClose={() => setMenuOpen(false)}>{Object.entries(icons).map(([key, Icon]) => <button key={key} className={page === key ? 'nav-link active' : 'nav-link'} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={21}/><span>{modules[key]}</span>{page === key && <Check size={17} className="nav-check"/>}</button>)}<button className="nav-link sign-out" disabled={busy} onClick={() => run(onSignOut, 'Sesión cerrada')}><LogOut size={21}/><span>Cerrar sesión</span></button></ModuleDrawer>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button className="icon-button" aria-label="Cerrar notificación" onClick={() => setToast('')}><X size={16}/></button></div>}
    {modal && <Modal busy={busy} onClose={() => setModal(null)} title={{prepared: modal.item ? 'Editar tarjeta de preparación' : 'Crear tarjeta de preparación', 'prepare-amount': `¿Cuántas ${modal.item?.name} desea preparar?`, 'delete-recipe': '¿Eliminar tarjeta de preparación?', 'cash-entry': 'Actualizar monto de caja', product: modal.item ? 'Editar producto' : 'Registrar producto', offer: modal.item ? 'Editar tarjeta de venta' : 'Añadir producto a la venta', payment: 'Registrar una venta', mixed: 'Efectivo + QR', 'actions-product': modal.item?.name, 'actions-offer': modal.item?.productIds ? saleName(modal.item, data.products) : '', 'close-register': '¿Está seguro de cerrar cajas?', 'confirm-offer': '¿Guardar cambios?', 'delete-product': '¿Eliminar producto?', 'delete-offer': '¿Eliminar tarjeta de venta?'}[modal.type]} subtitle={modal.type === 'payment' || modal.type === 'mixed' ? `${saleName(modal.item, data.products)} · Bs ${money(modal.item.priceCents)}` : undefined}>
      {error && <div className="error-banner" role="alert">{error}</div>}
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
      {modal.type === 'payment' && <div className="payment-options"><button disabled={busy} onClick={() => run(() => recordSale(modal.item.id, modal.item.priceCents, 0), 'Venta QR registrada')}><span className="payment-option-icon qr"><QrCode size={25}/></span><span><strong>QR</strong></span><ChevronRight size={18}/></button><button disabled={busy} onClick={() => run(() => recordSale(modal.item.id, 0, modal.item.priceCents), 'Venta en efectivo registrada')}><span className="payment-option-icon cash"><Banknote size={25}/></span><span><strong>Efectivo</strong></span><ChevronRight size={18}/></button><button disabled={busy} onClick={() => open('mixed', modal.item)}><span className="payment-option-icon mixed"><CircleDollarSign size={25}/></span><span><strong>Efectivo + QR</strong></span><ChevronRight size={18}/></button></div>}
      {modal.type.startsWith('delete') && <><p className="delete-copy">Eliminarás <strong>{modal.type === 'delete-product' || modal.type === 'delete-recipe' ? modal.item.name : saleName(modal.item, data.products)}</strong>.{modal.item.prepared && ' Se devolverán a inventario todos los ingredientes utilizados en esta preparación.'}{modal.type === 'delete-recipe' && ' Las bebidas ya preparadas se conservarán en inventario.'}</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button className="button delete-button" disabled={busy} onClick={() => run(() => removeItem(modal.type === 'delete-product' ? 'products' : modal.type === 'delete-recipe' ? 'recipes' : 'offers', modal.item.id), 'Eliminado correctamente')}><Trash2 size={16}/>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button></div></>}
      {modal.type === 'confirm-offer' && <><div className="edit-summary">{form.photo && <img className="offer-photo-preview" src={form.photo} alt="Foto de la tarjeta a guardar"/>}<strong>{saleName(form, data.products)}</strong><span>Bs {money(toCents(form.price))}</span></div><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal({...modal, type: 'offer'})}>Volver</button><button className="button primary" disabled={busy} onClick={() => run(() => saveOffer(form.productIds, toCents(form.price), modal.item.id, form.productQuantities, form.photo), 'Tarjeta actualizada')}><Check size={17}/>{busy ? 'Guardando…' : 'Confirmar cambios'}</button></div></>}
      {modal.type === 'close-register' && <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button><button className="button close-register-button" disabled={busy} onClick={() => run(() => closeRegister(modal.item), 'Cajas cerradas')}><Check size={17}/>{busy ? 'Cerrando…' : 'Aceptar'}</button></div>}
      {(modal.type === 'actions-product' || modal.type === 'actions-offer') && <div className="card-options-actions"><button className="button primary" onClick={() => open(modal.type === 'actions-product' ? 'product' : 'offer', modal.item)}><Pencil size={20}/>Editar</button><button className="button delete-button" onClick={() => open(modal.type === 'actions-product' ? 'delete-product' : 'delete-offer', modal.item)}><Trash2 size={20}/>Borrar</button></div>}
    </Modal>}
  </div>;
}
