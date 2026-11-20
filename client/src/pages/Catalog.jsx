/**
 * Catalogue with filters (categories, price range, rating), sorting, search
 * and presets: all / new / sale / favourites / brand (/brand/:name).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PRICE_MAX, initialFilters } from '../components/ShopLayout.jsx';
import { Icon, Stars } from '../lib/icons.jsx';
import { fmt, fmtDec, plural } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';

const PRESETS = {
  all: { title: 'Каталог', test: () => true },
  new: { title: 'Новинки', test: (p) => p.badge === 'new' || p.added >= 9 },
  sale: { title: 'Акции', test: (p) => Boolean(p.oldPrice) || p.audio },
  favorites: { title: 'Избранное', test: (p, favs) => favs.includes(p.id) },
};

const SORTS = {
  popular: { label: 'По популярности', fn: (a, b) => b.sold - a.sold },
  cheap: { label: 'Сначала дешёвые', fn: (a, b) => a.price - b.price },
  expensive: { label: 'Сначала дорогие', fn: (a, b) => b.price - a.price },
  rating: { label: 'По рейтингу', fn: (a, b) => b.rating - a.rating || b.reviews - a.reviews },
  new: { label: 'Сначала новые', fn: (a, b) => b.added - a.added },
};

export default function Catalog({ preset = 'all' }) {
  const { catalog, favs, toast } = useShop();
  const { filters, setFilters } = useOutletContext();
  const { brand } = useParams();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const { categories, products } = catalog;

  useEffect(() => {
    document.title = `${brand ? `Бренд ${brand}` : PRESETS[preset].title} — Nova Store`;
  }, [preset, brand]);

  const base = useMemo(() => products.filter((p) => PRESETS[preset].test(p, favs)), [products, preset, favs]);
  const items = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const catName = (id) => (categories.find((c) => c.id === id) || {}).name || '';
    return base
      .filter((p) => !filters.cats.length || filters.cats.includes(p.cat))
      .filter((p) => p.price >= filters.min && p.price <= filters.max)
      .filter((p) => p.rating >= filters.rating)
      .filter((p) => !brand || p.brand === brand)
      .filter((p) => !q || `${p.name} ${p.brand} ${catName(p.cat)}`.toLowerCase().includes(q))
      .sort(SORTS[filters.sort].fn);
  }, [base, filters, brand, categories]);

  const active = filters.cats.length || filters.min > 0 || filters.max < PRICE_MAX || filters.rating || filters.q;
  const title = brand
    ? `Бренд ${brand}`
    : preset === 'all' && filters.cats.length === 1
      ? categories.find((c) => c.id === filters.cats[0]).name
      : PRESETS[preset].title;

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggleCat = (id) => set({ cats: filters.cats.includes(id) ? filters.cats.filter((c) => c !== id) : [...filters.cats, id] });
  const setRange = (key, raw) => {
    const v = Number(raw);
    set({ [key]: key === 'min' ? Math.min(v, filters.max - 1000) : Math.max(v, filters.min + 1000) });
  };
  const reset = () => { setFilters(initialFilters()); if (brand) navigate('/'); };
  const copyPromo = () => {
    navigator.clipboard?.writeText('SOUND20').catch(() => {});
    toast('Промокод SOUND20 скопирован', 'copy');
  };

  const favEmpty = preset === 'favorites' && !favs.length;

  return (
    <div className="container catalog">
      <aside className={`filters${drawer ? ' is-open' : ''}`} aria-label="Фильтры">
        <div className="filters-head mobile-only">
          <strong>Фильтры</strong>
          <button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label="Закрыть фильтры"><Icon name="x" /></button>
        </div>

        <section className="filter-group">
          <h3>Категории</h3>
          {categories.map((c) => (
            <label className="check-row" key={c.id}>
              <input type="checkbox" checked={filters.cats.includes(c.id)} onChange={() => toggleCat(c.id)} />
              <span className="check-box"><Icon name="check" size={12} /></span>
              <span className="check-label">{c.name}</span>
              <span className="check-count">{base.filter((p) => p.cat === c.id).length}</span>
            </label>
          ))}
        </section>

        <section className="filter-group">
          <h3>Цена, ₽</h3>
          <div className="range" style={{ '--min': `${(filters.min / PRICE_MAX) * 100}%`, '--max': `${(filters.max / PRICE_MAX) * 100}%` }}>
            <div className="range-track"><span className="range-fill" /></div>
            <input type="range" min="0" max={PRICE_MAX} step="500" value={filters.min} onChange={(e) => setRange('min', e.target.value)} aria-label="Минимальная цена" />
            <input type="range" min="0" max={PRICE_MAX} step="500" value={filters.max} onChange={(e) => setRange('max', e.target.value)} aria-label="Максимальная цена" />
          </div>
          <div className="range-values"><span>{fmt(filters.min)}</span><span>{fmt(filters.max)}</span></div>
        </section>

        <section className="filter-group">
          <h3>Рейтинг</h3>
          {[[4.8, 5], [4.5, 4.5], [0, 0]].map(([value, shown]) => (
            <label className="radio-row" key={value}>
              <input type="radio" name="rating" checked={filters.rating === value} onChange={() => set({ rating: value })} />
              {value ? <><Stars rating={shown} /><span>{fmtDec(value, 1)} и выше</span></> : <span>Любой</span>}
            </label>
          ))}
        </section>

        <button type="button" className="promo-card" onClick={copyPromo}>
          <strong>−20% на аудио</strong>
          <span>До конца недели по промокоду</span>
          <code>SOUND20</code>
        </button>

        {active ? <button type="button" className="btn btn-ghost btn-block" onClick={reset}><Icon name="refresh" size={16} /> Сбросить фильтры</button> : null}
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <section className="catalog-main" aria-live="polite">
        <div className="catalog-head">
          <div>
            <h1>{title}</h1>
            <p className="muted">{fmt(items.length)} {plural(items.length, 'товар', 'товара', 'товаров')}{filters.q ? ` по запросу «${filters.q}»` : ''}</p>
          </div>
          <div className="catalog-tools">
            <button type="button" className="btn btn-ghost mobile-only" onClick={() => setDrawer(true)}><Icon name="filter" size={16} /> Фильтры</button>
            <label className="select">
              <Icon name="filter" size={16} />
              <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Сортировка">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
              <Icon name="chevronDown" size={14} />
            </label>
          </div>
        </div>

        {brand && <div className="active-chips"><Link className="chip" to="/">Бренд: {brand} <Icon name="x" size={12} /></Link></div>}

        {items.length ? (
          <div className="pgrid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        ) : favEmpty ? (
          <EmptyState icon="heart" title="В избранном пока пусто" text="Нажмите на сердечко у товара, чтобы сохранить его здесь.">
            <Link className="btn btn-primary" to="/">Перейти в каталог</Link>
          </EmptyState>
        ) : (
          <EmptyState title="Ничего не нашлось" text="Попробуйте изменить фильтры или поисковый запрос.">
            <button type="button" className="btn btn-primary" onClick={reset}>Сбросить фильтры</button>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
