/**
 * Slide-in cart panel.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '@nova/shared';
import { Icon, ProductArt } from '../lib/icons.jsx';
import { money, paletteOf, plural } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';
import EmptyState from './EmptyState.jsx';

export function Stepper({ value, onChange, small = false }) {
  return (
    <div className={`stepper${small ? ' stepper-sm' : ''}`} aria-label="Количество">
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Меньше"><Icon name="minus" size={small ? 14 : 16} /></button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Больше"><Icon name="plus" size={small ? 14 : 16} /></button>
    </div>
  );
}

export default function CartDrawer({ open, onClose }) {
  const { lines, totals, setQty, promo, toast } = useShop();
  const closeRef = useRef(null);
  const t = totals('courier');

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('no-scroll');
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <>
      {open && <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-label="Корзина" aria-hidden={!open}>
        <div className="drawer-head">
          <h2>Корзина <span className="muted">· {t.count} {plural(t.count, 'товар', 'товара', 'товаров')}</span></h2>
          <button type="button" ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Закрыть корзину"><Icon name="x" /></button>
        </div>

        {lines.length ? (
          <>
            <ul className="cart-lines">
              {lines.map((l) => (
                <li className="cart-line" key={`${l.id}-${l.color}`}>
                  <Link to={`/p/${l.id}`} className="line-art" onClick={onClose}><ProductArt kind={l.product.kind} palette={paletteOf(l.product, l.color)} /></Link>
                  <div className="line-info">
                    <Link to={`/p/${l.id}`} onClick={onClose}><strong>{l.product.name}</strong></Link>
                    <span className="muted">{COLORS[l.color]?.name} · {money(l.product.price)}</span>
                    <Stepper small value={l.qty} onChange={(q) => setQty(l.index, q)} />
                  </div>
                  <div className="line-side">
                    <strong>{money(l.sum)}</strong>
                    <button type="button" className="link-btn" aria-label="Удалить" onClick={() => { setQty(l.index, 0); toast('Товар удалён из корзины', 'trash'); }}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer-foot">
              <div className="sum-row"><span className="muted">Товары</span><span>{money(t.subtotal)}</span></div>
              {t.discount > 0 && <div className="sum-row"><span className="muted">Скидка ({promo.code})</span><span className="text-success">−{money(t.discount)}</span></div>}
              <div className="sum-row sum-total"><span>Итого</span><strong>{money(t.subtotal - t.discount)}</strong></div>
              <Link to="/checkout" className="btn btn-primary btn-lg btn-block" onClick={onClose}><Icon name="lock" size={17} /> Оформить заказ</Link>
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>Продолжить покупки</button>
            </div>
          </>
        ) : (
          <EmptyState className="empty-drawer" icon="cart" title="Корзина пуста" text="Добавьте товары из каталога — они появятся здесь.">
            <Link to="/" className="btn btn-primary" onClick={onClose}>В каталог</Link>
          </EmptyState>
        )}
      </aside>
    </>
  );
}
