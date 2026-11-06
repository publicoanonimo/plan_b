import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function ModuleDrawer({children, onClose}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    const dialog = ref.current;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} className="module-drawer" aria-label="Módulos" onCancel={event => {event.preventDefault(); onClose();}} onClick={event => {if (event.target === event.currentTarget) onClose();}}>
    <aside className="drawer-content"><div className="drawer-heading"><h2>Módulos</h2><button className="icon-button" aria-label="Cerrar módulos" onClick={onClose}><X size={23}/></button></div><nav id="module-navigation" aria-label="Módulos">{children}</nav></aside>
  </dialog>;
}
