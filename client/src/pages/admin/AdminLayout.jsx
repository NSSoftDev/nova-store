/**
 * Nova Admin shell: sidebar navigation + routed page.
 * Against the real API it asks for the ADMIN_TOKEN first (kept in
 * sessionStorage for the tab); the demo build needs no login.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';
import { api } from '../../api/index.js';
import { useShop } from '../../state/ShopContext.jsx';

const NAV = [
  { section: 'Магазин' },
  { to: '/admin', end: true, label: 'Обзор', icon: 'home' },
  { to: '/admin/orders', label: 'Заказы', icon: 'box' },
  { to: '/admin/products', label: 'Товары', icon: 'tag' },
  { to: '/admin/customers', label: 'Клиенты', icon: 'users' },
  { section: 'Аналитика' },
  { to: '/admin/sales', label: 'Продажи', icon: 'chart' },
  { to: '/admin/marketing', label: 'Маркетинг', icon: 'trending' },
  { to: '/admin/settings', label: 'Настройки', icon: 'settings' },
];

function Login({ onDone }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(token.trim());
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <span className="brand-mark"><Icon name="lock" /></span>
        <h1>Nova Admin</h1>
        <p className="muted">Введите токен администратора (переменная ADMIN_TOKEN сервера).</p>
        <label className="field"><span>Токен</span><input className="input mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoFocus required /></label>
        {error && <small className="field-error">{error}</small>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Проверяем…' : 'Войти'}</button>
        <Link to="/" className="link-btn"><Icon name="arrowLeft" size={14} /> В магазин</Link>
      </form>
    </div>
  );
}

export default function AdminLayout() {
  const [authed, setAuthed] = useState(() => !api.requiresLogin || api.hasAdminToken());
  const { reloadCatalog } = useShop();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Nova Admin'; document.body.dataset.mode = 'admin'; return () => { delete document.body.dataset.mode; }; }, []);

  // Admin edits change the storefront — refresh the catalogue when leaving
  useEffect(() => () => { reloadCatalog(); }, [reloadCatalog]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const logout = () => { api.logout(); setAuthed(false); navigate('/admin'); };

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link to="/admin" className="brand"><span className="brand-mark"><Icon name="cart" /></span><span className="brand-name">Nova Admin</span></Link>
        <nav aria-label="Разделы администратора">
          {NAV.map((n) => (n.section
            ? <p key={n.section} className="side-label">{n.section}</p>
            : <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}><Icon name={n.icon} /><span>{n.label}</span></NavLink>))}
        </nav>
        {api.requiresLogin && <button type="button" className="side-link side-logout" onClick={logout}><Icon name="lock" /><span>Выйти</span></button>}
        <Link to="/" className="side-store"><Icon name="store" /><span>Открыть магазин</span><Icon name="chevronRight" size={16} /></Link>
      </aside>
      <main className="admin-main" id="view" tabIndex={-1}>
        <Outlet context={{ onUnauthorized: () => { api.logout(); setAuthed(false); } }} />
      </main>
    </div>
  );
}
