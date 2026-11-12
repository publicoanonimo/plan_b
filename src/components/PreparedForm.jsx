import { useState } from 'react';
import { Check } from 'lucide-react';

export default function PreparedForm({products, recipe, busy, onSave, onClose}) {
  const [name, setName] = useState(recipe?.name || '');
  const [quantity, setQuantity] = useState(recipe?.quantity ?? '');
  const [selected, setSelected] = useState(Object.fromEntries((recipe?.ingredients || []).map(item => [item.productId, String(item.quantity)])));
  const ingredients = Object.entries(selected).map(([productId, amount]) => ({productId, quantity: amount}));
  function toggle(id) {
    setSelected(previous => {
      const next = {...previous};
      if (id in next) delete next[id]; else next[id] = '1';
      return next;
    });
  }
  return <form onSubmit={event => {event.preventDefault(); onSave({...recipe, name, quantity, ingredients});}}>
    <fieldset disabled={busy}>
      <label>Nombre de la tarjeta<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Cóctel preparado"/></label>
      <label>Cantidad de unidades preparadas<input type="number" required min="1" max="1000000000" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0"/></label>
      <p className="preparation-help">Configura los ingredientes para una tanda de estas unidades. Guardar la tarjeta no descuenta inventario.</p>
      <div className="preparation-products">{products.map(product => <div key={product.id} className={`preparation-option ${product.id in selected ? 'selected' : ''}`}>
        <label className="preparation-selection"><input type="checkbox" checked={product.id in selected} onChange={() => toggle(product.id)}/><span>{product.name}<small>{product.quantity} unidades disponibles</small></span></label>
        {product.id in selected && <label className="preparation-amount">Unidades por tanda<input type="number" required min="1" max="1000000000" step="1" value={selected[product.id]} onChange={event => setSelected(previous => ({...previous, [product.id]: event.target.value}))}/></label>}
      </div>)}{!products.length && <p className="muted">Registra productos en inventario para crear una tarjeta.</p>}</div>
      {ingredients.some(item => !products.some(product => product.id === item.productId)) && <div className="error-banner">Hay ingredientes eliminados. Desmárcalos y selecciona un reemplazo.{ingredients.filter(item => !products.some(product => product.id === item.productId)).map(item => <button type="button" className="button secondary" key={item.productId} onClick={() => toggle(item.productId)}>Quitar {recipe?.ingredients.find(ingredient => ingredient.productId === item.productId)?.name || 'producto eliminado'}</button>)}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={!ingredients.length}><Check size={16}/>{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </fieldset>
  </form>;
}
