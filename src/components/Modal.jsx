import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({title, subtitle, children, onClose, busy}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {dialog.close(); previous?.focus();};
  }, []);
  return <dialog ref={ref} className="modal" onCancel={e => {e.preventDefault(); if (!busy) onClose();}} onClick={e => {if (e.target === e.currentTarget && !busy) onClose();}}>
    <div className="modal-inner">
      <button type="button" className="icon-button close" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><X size={20}/></button>
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
      {children}
    </div>
  </dialog>;
}
