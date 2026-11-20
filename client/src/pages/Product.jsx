/**
 * Product page: colour swatches recolour the illustration, angle thumbnails,
 * quantity, perks, specs / reviews tabs, "bought together".
 */
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { COLORS } from '@nova/shared';
import ProductCard, { FavButton } from '../components/ProductCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Stepper } from '../components/CartDrawer.jsx';
import { initialFilters } from '../components/ShopLayout.jsx';
import { Icon, ProductArt, Stars } from '../lib/icons.jsx';
import { discountPercent, fmt, fmtDec, initials, money, paletteOf, plural } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';

const ANGLES = [
  { label: 'Вид спереди', transform: '' },
  { label: 'Вид сбоку', transform: 'rotate(-14deg) scale(.88)' },
  { label: 'Крупный план', transform: 'scale(1.45) translateY(6%)' },
  { label: 'Вид сзади', transform: 'scaleX(-1) rotate(10deg) scale(.9)' },
];

const REVIEWS = [
  { name: 'Мария Л.', rating: 5, text: 'Пользуюсь каждый день уже месяц — качество отличное, доставили на следующий день.' },
  { name: 'Игорь К.', rating: 5, text: 'Брал в подарок, упаковка аккуратная, всё как на фото. Рекомендую.' },
  { name: 'Анна О.', rating: 4, text: 'Хорошее соотношение цены и качества. Хотелось бы больше цветов.' },
  { name: 'Тимур А.', rating: 5, text: 'Третья покупка в Nova Store — всегда быстро и без сюрпризов.' },
  { name: 'Елена П.', rating: 4, text: 'Удобно и красиво. Снизила оценку только за долгую доставку в регион.' },
];

export default function Product() {
  const { id } = useParams();
  const { productById, catalog, addToCart } = useShop();
  const { setFilters } = useOutletContext();
  const product = productById.get(id);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [angle, setAngle] = useState(0);
  const [tab, setTab] = useState('specs');
  const [added, setAdded] = useState(false);

  // Reset local UI when navigating to another product
  useEffect(() => {
    setColor(product ? product.colors[0] : null);
    setQty(1);
    setAngle(0);
    setTab('specs');
    if (product) document.title = `${product.name} — Nova Store`;
  }, [id, product]);

  if (!product) {
    return (
      <div className="container page">
        <EmptyState icon="box" title="Товар не найден" text="Возможно, он снят с продажи.">
          <Link className="btn btn-primary" to="/">В каталог</Link>
        </EmptyState>
      </div>
    );
  }

  const activeColor = color && product.colors.includes(color) ? color : product.colors[0];
  const palette = paletteOf(product, activeColor);
  const off = discountPercent(product);
  const category = catalog.categories.find((c) => c.id === product.cat);
  const start = product.id.length % REVIEWS.length;
  const reviews = [0, 1, 2].map((i) => REVIEWS[(start + i) % REVIEWS.length]);
  const related = catalog.products
    .filter((p) => p.id !== product.id)
    .sort((a, b) => (b.cat === product.cat) - (a.cat === product.cat) || b.sold - a.sold)
    .slice(0, 4);

  const add = () => {
    addToCart(product.id, activeColor, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/">Каталог</Link><span>/</span>
        <Link to="/" onClick={() => setFilters({ ...initialFilters(), cats: [product.cat] })}>{category ? category.name : ''}</Link><span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-layout">
        <div className="gallery">
          <div className="gallery-main" style={{ '--glow': palette[0] }}>
            {(product.badge === 'new' || product.added >= 9) && <span className="pill pill-accent gallery-badge">Новинка 2026</span>}
            {product.badge === 'hit' && product.added < 9 && <span className="pill pill-accent gallery-badge">Хит продаж</span>}
            <FavButton id={product.id} size={18} />
            <div className="gallery-art"><ProductArt kind={product.kind} palette={palette} transform={ANGLES[angle].transform} /></div>
          </div>
          <div className="thumbs" role="tablist" aria-label="Ракурсы">
            {ANGLES.map((a, i) => (
              <button key={a.label} type="button" role="tab" aria-selected={i === angle} aria-label={a.label} className={`thumb${i === angle ? ' is-active' : ''}`} onClick={() => setAngle(i)}>
                <ProductArt kind={product.kind} palette={palette} transform={a.transform} />
              </button>
            ))}
          </div>
        </div>

        <div className="product-info">
          {product.stock > 0
            ? <span className="pill pill-success"><Icon name="check" size={13} /> В наличии · {product.stock} шт.</span>
            : <span className="pill pill-danger">Нет в наличии</span>}
          <h1>{product.name}</h1>
          <div className="product-rating"><Stars rating={product.rating} size={15} /><span>{fmtDec(product.rating, 1)} · {product.reviews} {plural(product.reviews, 'отзыв', 'отзыва', 'отзывов')}</span></div>
          <div className="product-price">
            <span className="price-xl">{money(product.price)}</span>
            {product.oldPrice && <><s className="old-price">{money(product.oldPrice)}</s><span className="pill pill-danger">−{off}%</span></>}
          </div>
          <p className="product-desc">{product.desc}</p>

          <div className="swatches-block">
            <span className="muted">Цвет: <strong>{COLORS[activeColor].name}</strong></span>
            <div className="swatches" role="radiogroup" aria-label="Цвет">
              {product.colors.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === activeColor} aria-label={COLORS[c].name}
                  className={`swatch${c === activeColor ? ' is-active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${COLORS[c].palette[0]}, ${COLORS[c].palette[1]})` }}
                  onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          <div className="buy-row">
            <Stepper value={qty} onChange={(q) => setQty(Math.min(99, Math.max(1, q)))} />
            <button type="button" className={`btn btn-primary btn-lg buy-btn${added ? ' is-added' : ''}`} onClick={add} disabled={product.stock <= 0}>
              <Icon name="cart" /> Добавить в корзину
            </button>
            <FavButton id={product.id} size={20} className="icon-btn icon-btn-lg" />
          </div>

          <div className="perks">
            <div className="perk"><span className="perk-ico"><Icon name="truck" /></span><div><strong>Доставка завтра</strong><span>Бесплатно от {money(catalog.settings.freeDeliveryFrom)}</span></div></div>
            <div className="perk"><span className="perk-ico"><Icon name="shield" /></span><div><strong>Гарантия 2 года</strong><span>Официальная</span></div></div>
            <div className="perk"><span className="perk-ico"><Icon name="card" /></span><div><strong>Сплит 4×{fmt(Math.ceil(product.price / 4))} ₽</strong><span>Без переплат</span></div></div>
          </div>
        </div>
      </div>

      <section className="product-tabs">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'specs'} className={`tab${tab === 'specs' ? ' is-active' : ''}`} onClick={() => setTab('specs')}>Характеристики</button>
          <button type="button" role="tab" aria-selected={tab === 'reviews'} className={`tab${tab === 'reviews' ? ' is-active' : ''}`} onClick={() => setTab('reviews')}>Отзывы · {product.reviews}</button>
        </div>
        {tab === 'specs' ? (
          <dl className="specs">
            {Object.entries(product.specs || {}).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            <div><dt>Бренд</dt><dd>{product.brand}</dd></div>
            <div><dt>Артикул</dt><dd className="mono">{product.id.toUpperCase()}</dd></div>
          </dl>
        ) : (
          <div className="reviews">
            {reviews.map((r) => (
              <article className="review" key={r.name}>
                <header><span className="avatar avatar-sm">{initials(r.name)}</span><strong>{r.name}</strong><Stars rating={r.rating} /></header>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="related">
        <h2>С этим покупают</h2>
        <div className="pgrid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>
    </div>
  );
}
