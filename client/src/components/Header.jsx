/**
 * Sticky storefront header: nav, live search (press "/"), favourites,
 * cart badge, account menu.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons.jsx';
import { useShop } from '../state/ShopContext.jsx';
import { api } from '../api/index.js';

export default function Header({ search, onSearch, onOpenCart }) {
  const { cartCount, favs } = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // "/" focuses search; Escape closes the menu
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
  }, []);

  useEffect(() => { setNavOpen(false); setMenuOpen(false); }, [location.pathname]);

  const handleSearch = (e) => {
    onSearch(e.target.value);
    const onCatalog = ['/', '/new', '/sale', '/favorites'].includes(location.pathname) || location.pathname.startsWith('/brand/');
    if (!onCatalog) navigate('/');
  };

  const resetDemo = () => {
    // eslint-disable-next-line no-alert
    if (api.reset && window.confirm('Сбросить корзину, заказы и изменения в админке?')) {
      api.reset();
      localStorage.removeItem('nova-store:cart:v2');
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  const navClass = ({ isActive }) => (isActive ? 'is-active' : undefined);

  return (
    <header className={`shop-header${navOpen ? ' nav-open' : ''}`}>
      <div className="container header-row">
        <Link to="/" className="brand" aria-label="Nova Store — на главную">
          <span className="brand-mark"><Icon name="cart" /></span>
          <span className="brand-name">Nova Store</span>
        </Link>

        <nav className="main-nav" aria-label="Разделы магазина">
          <NavLink to="/" end className={({ isActive }) => (isActive || location.pathname.startsWith('/p/') ? 'is-active' : undefined)}>Каталог</NavLink>
          <NavLink to="/new" className={navClass}>Новинки</NavLink>
          <NavLink to="/sale" className={navClass}>Акции</NavLink>
          <NavLink to="/brands" className={navClass}>Бренды</NavLink>
        </nav>

        <label className="search">
          <Icon name="search" size={17} />
          <input ref={inputRef} type="search" placeholder="Поиск товаров..." autoComplete="off" aria-label="Поиск товаров" value={search} onChange={handleSearch} />
          <kbd>/</kbd>
        </label>

        <div className="header-actions">
          <Link to="/favorites" className="icon-btn" aria-label="Избранное">
            <Icon name="heart" size={20} />
            {favs.length > 0 && <span className="badge-dot">{favs.length}</span>}
          </Link>
          <button type="button" className="icon-btn" onClick={onOpenCart} aria-label="Корзина">
            <Icon name="cart" size={20} />
            {cartCount > 0 && <span className="badge-dot">{cartCount}</span>}
          </button>
          <div className="account" ref={menuRef}>
            <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>АК</button>
            {menuOpen && (
              <div className="menu" role="menu">
                <div className="menu-head"><strong>Александра К.</strong><span>a.k@nova-store.app</span></div>
                <Link to="/admin" role="menuitem"><Icon name="chart" size={16} /> Панель администратора</Link>
                <Link to="/favorites" role="menuitem"><Icon name="heart" size={16} /> Избранное</Link>
                {api.mode === 'demo' && (
                  <button type="button" role="menuitem" onClick={resetDemo}><Icon name="refresh" size={16} /> Сбросить демо-данные</button>
                )}
              </div>
            )}
          </div>
          <button type="button" className="icon-btn mobile-only" aria-label="Меню" onClick={() => setNavOpen((o) => !o)}><Icon name="menu" size={20} /></button>
        </div>
      </div>
    </header>
  );
}
