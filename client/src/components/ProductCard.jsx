/**
 * Catalogue tile: badge, favourite toggle, illustration, rating, price, "+".
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, ProductArt, Stars } from '../lib/icons.jsx';
import { discountPercent, fmtDec, money, paletteOf } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';

export function ProductBadge({ product }) {
  const off = discountPercent(product);
  if (off) return <span className="pill pill-success">−{off}%</span>;
  if (product.badge === 'hit') return <span className="pill pill-accent">Хит</span>;
  if (product.badge === 'new') return <span className="pill pill-info">Новинка</span>;
  return null;
}

export function FavButton({ id, size = 16, className = 'fav-btn' }) {
  const { favs, toggleFav } = useShop();
  const on = favs.includes(id);
  return (
    <button type="button" className={`${className}${on ? ' is-on' : ''}`} aria-pressed={on} aria-label="В избранное" onClick={() => toggleFav(id)}>
      <Icon name="heart" size={size} />
    </button>
  );
}

export default function ProductCard({ product }) {
  const { addToCart } = useShop();
  const [added, setAdded] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const add = () => {
    addToCart(product.id);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1100);
  };

  return (
    <article className="pcard">
      <Link to={`/p/${product.id}`} className="pcard-media" aria-label={product.name}>
        <span className="pcard-badges"><ProductBadge product={product} /></span>
        <ProductArt kind={product.kind} palette={paletteOf(product)} />
      </Link>
      <FavButton id={product.id} />
      <div className="pcard-body">
        <Link to={`/p/${product.id}`} className="pcard-name">{product.name}</Link>
        <div className="pcard-rating"><Stars rating={product.rating} /><span>{fmtDec(product.rating, 1)} ({product.reviews})</span></div>
        <div className="pcard-foot">
          <div className="price-row">
            <span className="price">{money(product.price)}</span>
            {product.oldPrice && <s className="old-price">{money(product.oldPrice)}</s>}
          </div>
          <button type="button" className={`add-btn${added ? ' is-added' : ''}`} onClick={add} aria-label={`Добавить «${product.name}» в корзину`}>
            <Icon name={added ? 'check' : 'plus'} />
          </button>
        </div>
      </div>
    </article>
  );
}
