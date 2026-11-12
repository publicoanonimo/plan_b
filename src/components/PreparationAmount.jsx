import { useState } from 'react';
import { Check } from 'lucide-react';

export default function PreparationAmount({item, busy, onSave, onClose}) {
  const base = item.baseQuantity ?? (item.prepared ? item.preparedQuantity : item.quantity);
  const [quantity, setQuantity] = useState(item.prepared ? item.preparedQuantity : base);
  const ingredients = item.baseIngredients ?? item.ingredients;
  return <form onSubmit={event => {event.preventDefault(); onSave(quantity);}}><fieldset disabled={busy}>
    <label>Cantidad de unidades preparadas
      <div className="quantity-control"><button type="button" aria-label="Disminuir una tanda" disabled={quantity <= base} onClick={() => setQuantity(value => value - base)}>−</button><input aria-label="Cantidad de unidades preparadas" type="number" readOnly value={quantity}/><button type="button" aria-label="Aumentar una tanda" disabled={quantity + base > 1000000000} onClick={() => setQuantity(value => value + base)}>+</button></div>
    </label>
    <p className="preparation-help">Mínimo: {base} unidades. Cada paso añade o quita {base} unidades.</p>
    <ul className="recipe-ingredients">{ingredients.map(ingredient => <li key={ingredient.productId}>{ingredient.name}: <strong>{ingredient.quantity * (quantity / base)} uds.</strong></li>)}</ul>
    {item.prepared && <p className="preparation-help">Se ajustarán las existencias y se descontará o devolverá la diferencia de ingredientes.</p>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary"><Check size={16}/>{busy ? 'Guardando…' : item.prepared ? 'Guardar cambios' : 'Preparar'}</button></div>
  </fieldset></form>;
}
