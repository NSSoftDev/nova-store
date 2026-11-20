/**
 * Storefront shell: header + routed page + footer + cart drawer.
 * Holds catalogue filters so they survive navigation between pages.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import CartDrawer from './CartDrawer.jsx';
import EmptyState from './EmptyState.jsx';
import { Icon } from '../lib/icons.jsx';
import { useShop } from '../state/ShopContext.jsx';

export const PRICE_MAX = 50000;
export const initialFilters = () => ({ cats: [], min: 0, max: PRICE_MAX, rating: 0, sort: 'popular', q: '' });

const REPO_URL = 'https://github.com/NSSoftDev/nova-store';

export default function ShopLayout() {
  const { catalog, reloadCatalog } = useShop();
  const [filters, setFilters] = useState(initialFilters);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const closeCart = useCallback(() => setCartOpen(false), []);

  useEffect(() => { window.scrollTo(0, 0); setCartOpen(false); }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#view">Перейти к содержимому</a>
      <Header search={filters.q} onSearch={(q) => setFilters((f) => ({ ...f, q }))} onOpenCart={() => setCartOpen(true)} />
      <main id="view" className="view" tabIndex={-1}>
        {catalog.status === 'error' ? (
          <div className="container page">
            <EmptyState icon="x" title="Не удалось загрузить каталог" text={catalog.error}>
              <button type="button" className="btn btn-primary" onClick={reloadCatalog}><Icon name="refresh" size={16} /> Повторить</button>
            </EmptyState>
          </div>
        ) : catalog.status === 'loading' ? (
          <div className="container page"><div className="pgrid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" aria-hidden="true" />)}</div></div>
        ) : (
          <Outlet context={{ filters, setFilters, openCart: () => setCartOpen(true) }} />
        )}
      </main>
      <footer className="shop-footer">
        <div className="container footer-row">
          <span>© 2026 Nova Store · демо-проект <a href="https://nssoftdev.com" target="_blank" rel="noopener noreferrer">NSSoftDev</a></span>
          <span className="footer-links">
            <Link to="/admin"><Icon name="chart" size={15} /> Nova Admin</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer"><Icon name="grid" size={15} /> Код на GitHub</a>
          </span>
        </div>
      </footer>
      <CartDrawer open={cartOpen} onClose={closeCart} />
    </>
  );
}
