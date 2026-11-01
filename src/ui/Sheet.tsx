import { useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';

/** A modal built on <dialog>: a bottom sheet on phones, a centred dialog on desktop (see global.css). */
export default function Sheet({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  /** Omitted for a sheet the player has to answer (a pending bank request). */
  onClose?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => { if (!onClose) e.preventDefault(); }}
      onClick={(e) => { if (onClose && e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="sheet-body">
          <header className="sheet-header">
            <h2>{title}</h2>
            {onClose && (
              <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
                <Icon name="close" />
              </button>
            )}
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
