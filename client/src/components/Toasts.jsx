/**
 * Toast stack (bottom centre). Entries come from ShopContext.toast().
 */
import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { useShop } from '../state/ShopContext.jsx';

function Toast({ message, icon }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={`toast${shown ? ' is-in' : ''}`}>
      <Icon name={icon} size={16} />
      <span>{message}</span>
    </div>
  );
}

export default function Toasts() {
  const { toasts } = useShop();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} message={t.message} icon={t.icon} />)}
    </div>
  );
}
