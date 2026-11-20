/**
 * Brands overview → /brand/:name catalogue.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProductArt } from '../lib/icons.jsx';
import { money, paletteOf, plural } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';

export default function Brands() {
  const { catalog } = useShop();
  useEffect(() => { document.title = 'Бренды — Nova Store'; }, []);

  const byBrand = new Map();
  catalog.products.forEach((p) => byBrand.set(p.brand, [...(byBrand.get(p.brand) || []), p]));
  const brands = [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <div className="container page">
      <div className="catalog-head"><div><h1>Бренды</h1><p className="muted">{brands.length} {plural(brands.length, 'бренд', 'бренда', 'брендов')} в Nova Store</p></div></div>
      <div className="brand-grid">
        {brands.map(([name, items]) => (
          <Link key={name} className="brand-card" to={`/brand/${encodeURIComponent(name)}`}>
            <div className="brand-arts">{items.slice(0, 3).map((p) => <ProductArt key={p.id} kind={p.kind} palette={paletteOf(p)} />)}</div>
            <strong>{name}</strong>
            <span className="muted">{items.length} {plural(items.length, 'товар', 'товара', 'товаров')} · от {money(Math.min(...items.map((p) => p.price)))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
