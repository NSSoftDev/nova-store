/**
 * Товары: inline price / stock editing, storefront visibility, new product.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { CATEGORIES, COLORS } from '@nova/shared';
import { Icon, ProductArt } from '../../lib/icons.jsx';
import { fmt, money, paletteOf, plural } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { useShop } from '../../state/ShopContext.jsx';
import { api } from '../../api/index.js';
import { Async, PageHead, Toggle } from './common.jsx';

const KINDS = {
  headphones: 'Наушники', earbuds: 'TWS-наушники', watch: 'Часы', speaker: 'Колонка', camera: 'Камера', keyboard: 'Клавиатура',
  sneaker: 'Кроссовки', backpack: 'Рюкзак', lamp: 'Лампа', bottle: 'Бутылка', hoodie: 'Худи', dumbbell: 'Гантели', mug: 'Кружка', sunglasses: 'Очки',
};

function NewProductModal({ onClose, onCreated }) {
  const { toast } = useShop();
  const [form, setForm] = useState({ name: '', cat: 'electronics', kind: 'headphones', color: 'lavender', price: 4990, stock: 25, audio: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);
  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const product = await api.createProduct({ ...form, audio: form.audio === true || form.audio === 'true' });
      toast(`«${product.name}» добавлен в каталог`, 'check');
      onCreated(product);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="np-title" onSubmit={submit}>
        <div className="modal-head"><h2 id="np-title">Новый товар</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="x" /></button></div>
        <div className="np-preview"><ProductArt kind={form.kind} palette={COLORS[form.color].palette} /></div>
        <label className="field"><span>Название</span><input ref={nameRef} className="input" required minLength={3} maxLength={120} placeholder="Например, Наушники Aura Lite" value={form.name} onChange={set('name')} /></label>
        <div className="form-grid">
          <label className="field"><span>Категория</span><select className="input" value={form.cat} onChange={set('cat')}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Иллюстрация</span><select className="input" value={form.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Цвет</span><select className="input" value={form.color} onChange={set('color')}>{Object.entries(COLORS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select></label>
          <label className="field"><span>Цена, ₽</span><input className="input mono" type="number" min="100" step="10" required value={form.price} onChange={set('price')} /></label>
          <label className="field"><span>Остаток, шт.</span><input className="input mono" type="number" min="0" step="1" required value={form.stock} onChange={set('stock')} /></label>
          <label className="field"><span>Аудиотовар (SOUND20)</span><select className="input" value={String(form.audio)} onChange={set('audio')}><option value="false">Нет</option><option value="true">Да</option></select></label>
        </div>
        {error && <small className="field-error">{error}</small>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={busy}><Icon name="plus" size={16} /> {busy ? 'Сохраняем…' : 'Добавить в каталог'}</button>
        </div>
      </form>
    </>
  );
}

export function NewProductButton({ onCreated }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Новый товар</button>
      {open && <NewProductModal onClose={() => setOpen(false)} onCreated={onCreated} />}
    </>
  );
}

/** Number input that commits on blur / Enter. */
function NumberCell({ value, min, step, label, low, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = Math.max(min, Math.round(Number(draft) || 0));
    if (v !== value) onCommit(v); else setDraft(value);
  };
  return (
    <input className={`input input-sm mono num-input${low ? ' is-low' : ''}`} type="number" min={min} step={step} value={draft} aria-label={label}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
}

export default function Products() {
  const { onUnauthorized } = useOutletContext();
  const { toast } = useShop();
  const products = useApi(() => api.adminProducts(), []);

  const patch = async (p, change, message) => {
    try {
      const updated = await api.updateProduct(p.id, change);
      products.setData((list) => list.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      toast(message, 'tag');
    } catch (err) { toast(err.message, 'x'); }
  };

  return (
    <Async state={products} onUnauthorized={onUnauthorized}>
      {(list) => (
        <>
          <PageHead title="Товары" sub={`${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')} · цена и остаток редактируются прямо в таблице`}>
            <NewProductButton onCreated={(p) => products.setData((l) => [p, ...l])} />
          </PageHead>
          <section className="panel">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Товар</th><th>Категория</th><th>Цена, ₽</th><th>Остаток</th><th>Продано</th><th>На витрине</th></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className={p.hidden ? 'is-muted' : undefined}>
                      <td><Link to={`/p/${p.id}`} className="product-cell"><span className="top-art"><ProductArt kind={p.kind} palette={paletteOf(p)} /></span><span><strong>{p.name}</strong><span className="muted mono">{p.id}</span></span></Link></td>
                      <td className="muted">{(CATEGORIES.find((c) => c.id === p.cat) || {}).name}</td>
                      <td><NumberCell value={p.price} min={1} step={10} label={`Цена ${p.name}`} onCommit={(v) => patch(p, { price: v }, `Цена обновлена: ${money(v)}`)} /></td>
                      <td><NumberCell value={p.stock} min={0} step={1} low={p.stock < 15} label={`Остаток ${p.name}`} onCommit={(v) => patch(p, { stock: v }, `Остаток обновлён: ${v} шт.`)} /></td>
                      <td>{fmt(p.sold)}</td>
                      <td><Toggle checked={!p.hidden} label={`Показывать ${p.name}`} onChange={(on) => patch(p, { hidden: !on }, on ? 'Товар снова на витрине' : 'Товар скрыт с витрины')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Async>
  );
}
