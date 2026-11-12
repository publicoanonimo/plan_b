import { useRef } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';

export default function OfferPhotoField({photo, onSelect, onRemove}) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const select = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onSelect(file);
  };
  return <div className="offer-photo-field">
    <span>Foto de la tarjeta (opcional)</span>
    {photo && <img className="offer-photo-preview" src={photo} alt="Vista previa de la foto de la tarjeta"/>}
    <div className="offer-photo-actions">
      <button type="button" className="button secondary" onClick={() => fileRef.current.click()}><ImagePlus size={18}/>{photo ? 'Cambiar foto' : 'Añadir foto'}</button>
      <button type="button" className="button secondary" onClick={() => cameraRef.current.click()}><Camera size={18}/>Tomar foto</button>
      {photo && <button type="button" className="button secondary" onClick={onRemove}><Trash2 size={18}/>Quitar foto</button>}
    </div>
    <input hidden ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Seleccionar foto de la tarjeta" onChange={select}/>
    <input hidden ref={cameraRef} type="file" accept="image/*" capture="environment" aria-label="Tomar foto de la tarjeta" onChange={select}/>
    <p className="offer-photo-help">La foto se comprime automáticamente. Los cambios se aplican al guardar la tarjeta.</p>
  </div>;
}
