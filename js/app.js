/* ==========================================================================
   Nova Store — app.js
   --------------------------------------------------------------------------
   Boot + hash router + shells + one delegated event layer.
     Routes
       #/                 catalogue          #/p/:id       product page
       #/new  #/sale      catalogue presets  #/checkout    checkout
       #/favorites        favourites         #/brands      brands
       #/brand/:name      brand catalogue    #/admin[/:page] Nova Admin
   Hash routing keeps the app fully static (works on GitHub Pages and when
   opened straight from disk).
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});
  const { html, raw, icon } = Nova;
  const app = document.getElementById('app');
  const REPO_URL = 'https://github.com/NSSoftDev/nova-store';

  let mode = null;     // 'shop' | 'admin'
  let route = null;    // parsed current route

  /* ------------------------------------------------------------------
     Router
     ------------------------------------------------------------------ */
  function parse(hash) {
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [a, b] = parts;
    if (!a) return { name: 'catalog', preset: 'all', brand: null };
    if (a === 'new' || a === 'sale' || a === 'favorites') return { name: a, view: 'catalog', preset: a, brand: null };
    if (a === 'brands') return { name: 'brands' };
    if (a === 'brand' && b) return { name: 'catalog', preset: 'all', brand: b };
    if (a === 'p' && b) return { name: 'product', id: b };
    if (a === 'checkout') return { name: 'checkout' };
    if (a === 'admin') return { name: 'admin', page: Nova.adminViews[b] ? b : 'overview' };
    return { name: 'catalog', preset: 'all', brand: null };
  }

  const TITLES = {
    catalog: 'Каталог', new: 'Новинки', sale: 'Акции', favorites: 'Избранное', brands: 'Бренды', checkout: 'Оформление заказа',
  };

  function shopShell() {
    return html`
      ${Nova.renderHeader()}
      <main id="view" class="view" tabindex="-1"></main>
      <footer class="shop-footer">
        <div class="container footer-row">
          <span>© 2026 Nova Store · демо-проект <a href="https://nssoftdev.com" target="_blank" rel="noopener">NSSoftDev</a></span>
          <span class="footer-links">
            <a href="#/admin">${raw(icon('chart', 15))} Nova Admin</a>
            <a href="${REPO_URL}" target="_blank" rel="noopener">${raw(icon('grid', 15))} Код на GitHub</a>
          </span>
        </div>
      </footer>
      <div class="drawer-scrim" data-action="close-cart" hidden></div>
      <aside class="drawer" id="cart-drawer" aria-label="Корзина" aria-hidden="true"></aside>`;
  }

  function currentView() {
    if (route.name === 'admin') return null;
    return Nova.views[route.view || route.name];
  }

  /** Renders the current route into #view (keeps the shell). */
  function render() {
    const view = document.getElementById('view');
    if (!view) return;
    if (route.name === 'admin') {
      view.innerHTML = Nova.adminViews[route.page]().value;
      Nova.syncAdminNav(route.page);
      return;
    }
    view.innerHTML = currentView().render(route).value;
    Nova.syncHeader(route);
  }
  Nova.rerender = render;

  function navigate() {
    const prev = route;
    route = parse(location.hash);
    const nextMode = route.name === 'admin' ? 'admin' : 'shop';

    if (prev && prev.name === 'checkout' && route.name !== 'checkout') Nova.resetCheckoutIfDone();

    if (nextMode !== mode) {
      mode = nextMode;
      document.body.dataset.mode = mode;
      app.innerHTML = (mode === 'admin' ? Nova.renderAdminShell() : shopShell()).value;
      if (mode === 'shop') {
        const input = document.getElementById('search-input');
        input.value = Nova.filters.q;
      }
    }

    closeMenus();
    closeCart();
    document.querySelector('.shop-header') && document.querySelector('.shop-header').classList.remove('nav-open');
    render();

    const title = route.name === 'admin' ? 'Nova Admin'
      : route.name === 'product' ? ((Nova.product(route.id) || {}).name || 'Товар')
      : TITLES[route.name] || 'Каталог';
    document.title = `${title} — Nova Store`;

    // Scroll to top on real page changes, not on re-renders
    if (!prev || prev.name !== route.name || prev.id !== route.id || prev.page !== route.page || prev.preset !== route.preset) {
      window.scrollTo(0, 0);
    }
  }

  /* ------------------------------------------------------------------
     Cart drawer + menus
     ------------------------------------------------------------------ */
  function openCart() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    drawer.innerHTML = Nova.renderCartDrawer().value;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('.drawer-scrim').hidden = false;
    document.body.classList.add('no-scroll');
    const close = drawer.querySelector('[data-action="close-cart"]');
    if (close) close.focus();
  }

  function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.querySelector('.drawer-scrim').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  function closeMenus(except) {
    document.querySelectorAll('.account .menu').forEach((m) => {
      if (m !== except) {
        m.hidden = true;
        const btn = m.parentElement.querySelector('[data-action="toggle-account"]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function toggleFilters(open) {
    const f = document.getElementById('filters');
    const scrim = document.querySelector('.catalog ~ .scrim');
    if (!f) return;
    f.classList.toggle('is-open', open);
    if (scrim) scrim.hidden = !open;
    document.body.classList.toggle('no-scroll', open);
  }

  /** Brief "added" feedback on a + button. */
  function flashAdded(btn) {
    btn.classList.add('is-added');
    btn.innerHTML = icon('check', 18);
    setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = icon('plus', 18); }, 1100);
  }

  /* ------------------------------------------------------------------
     Delegated actions
     ------------------------------------------------------------------ */
  const actions = {
    add(el) { Nova.addToCart(el.dataset.id); flashAdded(el); },
    fav(el) { Nova.toggleFav(el.dataset.id); },
    'open-cart'() { openCart(); },
    'close-cart'() { closeCart(); },
    'line-qty'(el) {
      const line = Nova.state.cart[Number(el.dataset.index)];
      if (line) Nova.setQty(Number(el.dataset.index), line.qty + Number(el.dataset.delta));
    },
    'line-remove'(el) { Nova.setQty(Number(el.dataset.index), 0); Nova.toast('Товар удалён из корзины', 'trash'); },
    'toggle-account'(el) {
      const menu = el.parentElement.querySelector('.menu');
      const open = menu.hidden;
      closeMenus();
      menu.hidden = !open;
      el.setAttribute('aria-expanded', String(open));
    },
    'toggle-nav'() { document.querySelector('.shop-header').classList.toggle('nav-open'); },
    'reset-demo'() {
      // eslint-disable-next-line no-alert
      if (window.confirm('Сбросить корзину, заказы и изменения в админке?')) Nova.resetDemo();
    },
    'copy-promo'(el) { Nova.copy(el.dataset.code, `Промокод ${el.dataset.code} скопирован`); },
    'reset-filters'() { Nova.resetFilters(); if (route.brand) location.hash = '#/'; else render(); },
    'clear-brand'() { Nova.filters.brand = null; location.hash = '#/'; },
    'filter-cat'(el, e) {
      e.preventDefault();
      Nova.resetFilters();
      Nova.filters.cats.add(el.dataset.cat);
      if (location.hash === '#/' || location.hash === '') render(); else location.hash = '#/';
    },
    'open-filters'() { toggleFilters(true); },
    'close-filters'() { toggleFilters(false); },

    /* product page */
    thumb(el) {
      Nova.productUi.thumb = Number(el.dataset.index);
      render();
    },
    color(el) { Nova.productUi.color = el.dataset.color; render(); },
    qty(el) {
      Nova.productUi.qty = Math.min(99, Math.max(1, Nova.productUi.qty + Number(el.dataset.delta)));
      const out = document.getElementById('qty-value');
      if (out) out.textContent = Nova.productUi.qty;
    },
    'add-product'(el) {
      Nova.addToCart(Nova.productUi.id, Nova.productUi.color, Nova.productUi.qty);
      el.classList.add('is-added');
      setTimeout(() => el.classList.remove('is-added'), 900);
    },
    tab(el) { Nova.productUi.tab = el.dataset.tab; render(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    // close account menu when clicking elsewhere
    if (!e.target.closest('.account')) closeMenus();
    if (!e.target.closest('.range-picker') && document.querySelector('.range-picker .menu:not([hidden])')) {
      Nova.adminActions['range-toggle']();
    }
    if (!el) return;
    const name = el.dataset.action;
    const handler = actions[name] || Nova.checkoutActions[name] || Nova.adminActions[name];
    if (!handler) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    handler(el, e);
  });

  /* Inputs: filters, checkout form, admin inline editing, search */
  function onInput(e) {
    const t = e.target;
    if (t.id === 'search-input') {
      Nova.filters.q = t.value;
      if (!route || (route.view || route.name) !== 'catalog') {
        location.hash = '#/';
      } else {
        Nova.views.catalog.refresh(route);
      }
      return;
    }
    if (mode === 'admin') { Nova.adminInput(e); return; }
    const view = currentView();
    if (view && view.onInput) view.onInput(e, route);
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => {
    // range/checkbox/select fire both; avoid double work for text inputs
    if (e.target.matches('input[type="checkbox"], input[type="radio"], select, input[type="number"]')) onInput(e);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'promo') Nova.applyPromo(form.querySelector('[name="promo"]').value);
    if (form.dataset.form === 'new-product') Nova.createProduct(form);
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && mode === 'shop') {
      e.preventDefault();
      document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') {
      closeCart();
      closeMenus();
      toggleFilters(false);
      if (Nova.closeModal) Nova.closeModal();
    }
  });

  document.addEventListener('pointermove', (e) => { if (mode === 'admin') Nova.chartHover(e); });
  document.addEventListener('pointerout', (e) => {
    if (mode === 'admin' && e.target.closest('[data-chart]') && !e.target.closest('[data-chart]').contains(e.relatedTarget)) Nova.chartLeave(e);
  });

  /* ------------------------------------------------------------------
     React to state changes
     ------------------------------------------------------------------ */
  Nova.subscribe(() => {
    if (mode === 'shop') {
      Nova.syncHeader();
      const drawer = document.getElementById('cart-drawer');
      if (drawer && drawer.classList.contains('is-open')) drawer.innerHTML = Nova.renderCartDrawer().value;
      const view = currentView();
      if (view && view.onState) view.onState(route);
    } else if (mode === 'admin' && !document.querySelector('.modal')) {
      render();
    }
  });

  // Keep several open tabs in sync (e.g. shop in one tab, admin in another)
  window.addEventListener('storage', (e) => {
    if (e.key === 'nova-store:v1') location.reload();
  });

  window.addEventListener('hashchange', navigate);
  navigate();
})();
