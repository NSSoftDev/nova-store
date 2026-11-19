/* ==========================================================================
   Nova Store — shop.js
   --------------------------------------------------------------------------
   Customer-facing views:
     • header (nav, live search, favourites, cart badge, account menu)
     • catalogue with filters (categories, price range, rating, sort) and
       presets: all / new / sale / favourites / brand
     • product page (colour swatches recolour the illustration, angle
       thumbnails, quantity, specs + reviews tabs, "bought together")
     • brands page
     • cart drawer
   Views return markup via Nova.html; interaction is wired through
   data-action attributes handled by the delegated listener in app.js.
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});
  const D = Nova.data;
  const { html, raw, icon, money, fmt } = Nova;

  /* Catalogue filter state lives in memory for the session */
  const PRICE_MAX = 50000;
  const filters = {
    cats: new Set(),
    min: 0,
    max: PRICE_MAX,
    rating: 0,
    sort: 'popular',
    q: '',
    brand: null,
  };
  Nova.filters = filters;

  const PRESETS = {
    all: { title: 'Каталог', test: () => true },
    new: { title: 'Новинки', test: (p) => p.badge === 'new' || p.added >= 9 },
    sale: { title: 'Акции', test: (p) => !!p.oldPrice || p.audio },
    favorites: { title: 'Избранное', test: (p) => Nova.state.favs.includes(p.id) },
  };

  const SORTS = {
    popular: { label: 'По популярности', fn: (a, b) => b.sold - a.sold },
    cheap: { label: 'Сначала дешёвые', fn: (a, b) => a.price - b.price },
    expensive: { label: 'Сначала дорогие', fn: (a, b) => b.price - a.price },
    rating: { label: 'По рейтингу', fn: (a, b) => b.rating - a.rating || b.reviews - a.reviews },
    new: { label: 'Сначала новые', fn: (a, b) => b.added - a.added },
  };

  /* ------------------------------------------------------------------
     HEADER (rendered once per shop session; badges refresh on state)
     ------------------------------------------------------------------ */
  Nova.renderHeader = function renderHeader() {
    return html`
      <header class="shop-header">
        <div class="container header-row">
          <a href="#/" class="brand" aria-label="Nova Store — на главную">
            <span class="brand-mark">${raw(icon('cart', 18))}</span>
            <span class="brand-name">Nova Store</span>
          </a>
          <nav class="main-nav" aria-label="Разделы магазина">
            <a href="#/" data-nav="catalog">Каталог</a>
            <a href="#/new" data-nav="new">Новинки</a>
            <a href="#/sale" data-nav="sale">Акции</a>
            <a href="#/brands" data-nav="brands">Бренды</a>
          </nav>
          <label class="search">
            ${raw(icon('search', 17))}
            <input id="search-input" type="search" placeholder="Поиск товаров..." autocomplete="off" aria-label="Поиск товаров" />
            <kbd>/</kbd>
          </label>
          <div class="header-actions">
            <a href="#/favorites" class="icon-btn" aria-label="Избранное">
              ${raw(icon('heart', 20))}<span class="badge-dot" data-badge="favs" hidden></span>
            </a>
            <button type="button" class="icon-btn" data-action="open-cart" aria-label="Корзина">
              ${raw(icon('cart', 20))}<span class="badge-dot" data-badge="cart" hidden></span>
            </button>
            <div class="account">
              <button type="button" class="avatar" data-action="toggle-account" aria-haspopup="menu" aria-expanded="false">АК</button>
              <div class="menu" role="menu" hidden>
                <div class="menu-head"><strong>Александра К.</strong><span>a.k@nova-store.app</span></div>
                <a href="#/admin" role="menuitem">${raw(icon('chart', 16))} Панель администратора</a>
                <a href="#/favorites" role="menuitem">${raw(icon('heart', 16))} Избранное</a>
                <button type="button" role="menuitem" data-action="reset-demo">${raw(icon('refresh', 16))} Сбросить демо-данные</button>
              </div>
            </div>
            <button type="button" class="icon-btn mobile-only" data-action="toggle-nav" aria-label="Меню">${raw(icon('menu', 20))}</button>
          </div>
        </div>
      </header>`;
  };

  /** Updates header badges + active nav link without re-rendering it. */
  Nova.syncHeader = function syncHeader(route) {
    const cart = Nova.cartCount();
    const favs = Nova.state.favs.length;
    document.querySelectorAll('[data-badge="cart"]').forEach((b) => { b.hidden = !cart; b.textContent = cart; });
    document.querySelectorAll('[data-badge="favs"]').forEach((b) => { b.hidden = !favs; b.textContent = favs; });
    if (route) {
      const active = { catalog: 'catalog', product: 'catalog', new: 'new', sale: 'sale', brands: 'brands' }[route.name];
      document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === active));
    }
  };

  /* ------------------------------------------------------------------
     PRODUCT CARD
     ------------------------------------------------------------------ */
  function badgeFor(p) {
    const off = Nova.discountPercent(p);
    if (off) return html`<span class="pill pill-success">−${off}%</span>`;
    if (p.badge === 'hit') return html`<span class="pill pill-accent">Хит</span>`;
    if (p.badge === 'new') return html`<span class="pill pill-info">Новинка</span>`;
    return '';
  }

  function productCard(p) {
    const fav = Nova.state.favs.includes(p.id);
    return html`
      <article class="pcard">
        <a href="#/p/${p.id}" class="pcard-media" aria-label="${p.name}">
          <span class="pcard-badges">${badgeFor(p)}</span>
          ${raw(Nova.art(p.kind, Nova.palette(p)))}
        </a>
        <button type="button" class="fav-btn${fav ? ' is-on' : ''}" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="В избранное">${raw(icon('heart', 16))}</button>
        <div class="pcard-body">
          <a href="#/p/${p.id}" class="pcard-name">${p.name}</a>
          <div class="pcard-rating">${raw(Nova.stars(p.rating))}<span>${Nova.fmtDec(p.rating, 1)} (${p.reviews})</span></div>
          <div class="pcard-foot">
            <div class="price-row">
              <span class="price">${money(p.price)}</span>
              ${p.oldPrice ? html`<s class="old-price">${money(p.oldPrice)}</s>` : ''}
            </div>
            <button type="button" class="add-btn" data-action="add" data-id="${p.id}" aria-label="Добавить «${p.name}» в корзину">${raw(icon('plus', 18))}</button>
          </div>
        </div>
      </article>`;
  }
  Nova.productCard = productCard;

  /* ------------------------------------------------------------------
     CATALOGUE
     ------------------------------------------------------------------ */
  function filtered(preset) {
    const q = filters.q.trim().toLowerCase();
    return Nova.allProducts()
      .filter(PRESETS[preset].test)
      .filter((p) => !filters.cats.size || filters.cats.has(p.cat))
      .filter((p) => p.price >= filters.min && p.price <= filters.max)
      .filter((p) => p.rating >= filters.rating)
      .filter((p) => !filters.brand || p.brand === filters.brand)
      .filter((p) => !q || `${p.name} ${p.brand} ${Nova.category(p.cat).name}`.toLowerCase().includes(q))
      .sort(SORTS[filters.sort].fn);
  }

  function catalogTitle(preset) {
    if (filters.brand) return `Бренд ${filters.brand}`;
    if (preset === 'all' && filters.cats.size === 1) return Nova.category([...filters.cats][0]).name;
    return PRESETS[preset].title;
  }

  function filtersActive() {
    return filters.cats.size || filters.min > 0 || filters.max < PRICE_MAX || filters.rating || filters.q || filters.brand;
  }

  function sidebar(preset) {
    const base = Nova.allProducts().filter(PRESETS[preset].test);
    const count = (cat) => base.filter((p) => p.cat === cat).length;
    return html`
      <aside class="filters" id="filters" aria-label="Фильтры">
        <div class="filters-head mobile-only">
          <strong>Фильтры</strong>
          <button type="button" class="icon-btn" data-action="close-filters" aria-label="Закрыть фильтры">${raw(icon('x', 18))}</button>
        </div>

        <section class="filter-group">
          <h3>Категории</h3>
          ${D.CATEGORIES.map((c) => html`
            <label class="check-row">
              <input type="checkbox" data-filter="cat" value="${c.id}" ${filters.cats.has(c.id) ? 'checked' : ''} />
              <span class="check-box">${raw(icon('check', 12))}</span>
              <span class="check-label">${c.name}</span>
              <span class="check-count">${count(c.id)}</span>
            </label>`)}
        </section>

        <section class="filter-group">
          <h3>Цена, ₽</h3>
          <div class="range" style="--min:${(filters.min / PRICE_MAX) * 100}%;--max:${(filters.max / PRICE_MAX) * 100}%">
            <div class="range-track"><span class="range-fill"></span></div>
            <input type="range" min="0" max="${PRICE_MAX}" step="500" value="${filters.min}" data-filter="min" aria-label="Минимальная цена" />
            <input type="range" min="0" max="${PRICE_MAX}" step="500" value="${filters.max}" data-filter="max" aria-label="Максимальная цена" />
          </div>
          <div class="range-values"><span data-range-label="min">${fmt(filters.min)}</span><span data-range-label="max">${fmt(filters.max)}</span></div>
        </section>

        <section class="filter-group">
          <h3>Рейтинг</h3>
          ${[[4.8, 5], [4.5, 4.5], [0, 0]].map(([value, starsShown]) => html`
            <label class="radio-row">
              <input type="radio" name="rating" data-filter="rating" value="${value}" ${filters.rating === value ? 'checked' : ''} />
              ${value ? html`${raw(Nova.stars(starsShown, 12))}<span>${Nova.fmtDec(value, 1)} и выше</span>` : html`<span>Любой</span>`}
            </label>`)}
        </section>

        <button type="button" class="promo-card" data-action="copy-promo" data-code="SOUND20">
          <strong>−20% на аудио</strong>
          <span>До конца недели по промокоду</span>
          <code>SOUND20</code>
        </button>

        <button type="button" class="btn btn-ghost btn-block" data-action="reset-filters" ${filtersActive() ? '' : 'hidden'}>${raw(icon('refresh', 16))} Сбросить фильтры</button>
      </aside>`;
  }

  function gridMarkup(preset) {
    const items = filtered(preset);
    if (!items.length) {
      const favEmpty = preset === 'favorites' && !Nova.state.favs.length;
      return html`
        <div class="empty">
          <span class="empty-icon">${raw(icon(favEmpty ? 'heart' : 'search', 26))}</span>
          <h3>${favEmpty ? 'В избранном пока пусто' : 'Ничего не нашлось'}</h3>
          <p>${favEmpty ? 'Нажмите на сердечко у товара, чтобы сохранить его здесь.' : 'Попробуйте изменить фильтры или поисковый запрос.'}</p>
          ${favEmpty ? html`<a class="btn btn-primary" href="#/">Перейти в каталог</a>` : html`<button type="button" class="btn btn-primary" data-action="reset-filters">Сбросить фильтры</button>`}
        </div>`;
    }
    return html`<div class="pgrid">${items.map(productCard)}</div>`;
  }

  Nova.views = Nova.views || {};

  Nova.views.catalog = {
    render(route) {
      const preset = route.preset || 'all';
      if (route.brand !== undefined) filters.brand = route.brand;
      const total = filtered(preset).length;
      return html`
        <div class="container catalog">
          ${sidebar(preset)}
          <section class="catalog-main" aria-live="polite">
            <div class="catalog-head">
              <div>
                <h1 id="catalog-title">${catalogTitle(preset)}</h1>
                <p class="muted" id="catalog-count">${fmt(total)} ${Nova.plural(total, 'товар', 'товара', 'товаров')}${filters.q ? ` по запросу «${filters.q}»` : ''}</p>
              </div>
              <div class="catalog-tools">
                <button type="button" class="btn btn-ghost mobile-only" data-action="open-filters">${raw(icon('filter', 16))} Фильтры</button>
                <label class="select">
                  ${raw(icon('filter', 16))}
                  <select data-filter="sort" aria-label="Сортировка">
                    ${Object.entries(SORTS).map(([k, s]) => html`<option value="${k}" ${filters.sort === k ? 'selected' : ''}>${s.label}</option>`)}
                  </select>
                  ${raw(icon('chevronDown', 14))}
                </label>
              </div>
            </div>
            ${filters.brand ? html`<div class="active-chips"><button type="button" class="chip" data-action="clear-brand">Бренд: ${filters.brand} ${raw(icon('x', 12))}</button></div>` : ''}
            <div id="catalog-grid">${gridMarkup(preset)}</div>
          </section>
        </div>
        <div class="scrim" data-action="close-filters" hidden></div>`;
    },

    /** Re-renders only the grid + counters so sidebar inputs keep focus. */
    refresh(route) {
      const preset = route.preset || 'all';
      const grid = document.getElementById('catalog-grid');
      if (!grid) return;
      const total = filtered(preset).length;
      grid.innerHTML = gridMarkup(preset).value;
      document.getElementById('catalog-title').textContent = catalogTitle(preset);
      document.getElementById('catalog-count').textContent = `${fmt(total)} ${Nova.plural(total, 'товар', 'товара', 'товаров')}${filters.q ? ` по запросу «${filters.q}»` : ''}`;
      const reset = document.querySelector('.filters [data-action="reset-filters"]');
      if (reset) reset.hidden = !filtersActive();
    },

    /** Favourites list must update when a heart is toggled. */
    onState(route) {
      if (route.preset === 'favorites') this.refresh(route);
      else document.querySelectorAll('.fav-btn').forEach((b) => {
        const on = Nova.state.favs.includes(b.dataset.id);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
      });
    },

    /** Handles change/input events from the filter controls. */
    onInput(e, route) {
      const t = e.target;
      const f = t.dataset.filter;
      if (!f) return;
      if (f === 'cat') {
        if (t.checked) filters.cats.add(t.value); else filters.cats.delete(t.value);
      } else if (f === 'min' || f === 'max') {
        let v = Number(t.value);
        // keep at least 1 000 ₽ between the two thumbs
        if (f === 'min') v = Math.min(v, filters.max - 1000);
        else v = Math.max(v, filters.min + 1000);
        t.value = v;
        filters[f] = v;
        const range = t.closest('.range');
        range.style.setProperty(`--${f}`, `${(v / PRICE_MAX) * 100}%`);
        document.querySelector(`[data-range-label="${f}"]`).textContent = fmt(v);
      } else if (f === 'rating') {
        filters.rating = Number(t.value);
      } else if (f === 'sort') {
        filters.sort = t.value;
      }
      this.refresh(route);
    },
  };

  Nova.resetFilters = function resetFilters() {
    filters.cats.clear();
    filters.min = 0;
    filters.max = PRICE_MAX;
    filters.rating = 0;
    filters.q = '';
    filters.brand = null;
    const input = document.getElementById('search-input');
    if (input) input.value = '';
  };

  /* ------------------------------------------------------------------
     PRODUCT PAGE
     ------------------------------------------------------------------ */
  const THUMB_ANGLES = [
    { label: 'Вид спереди', transform: '' },
    { label: 'Вид сбоку', transform: 'rotate(-14deg) scale(.88)' },
    { label: 'Крупный план', transform: 'scale(1.45) translateY(6%)' },
    { label: 'Вид сзади', transform: 'scaleX(-1) rotate(10deg) scale(.9)' },
  ];

  const REVIEW_POOL = [
    { name: 'Мария Л.', rating: 5, text: 'Пользуюсь каждый день уже месяц — качество отличное, доставили на следующий день.' },
    { name: 'Игорь К.', rating: 5, text: 'Брал в подарок, упаковка аккуратная, всё как на фото. Рекомендую.' },
    { name: 'Анна О.', rating: 4, text: 'Хорошее соотношение цены и качества. Хотелось бы больше цветов.' },
    { name: 'Тимур А.', rating: 5, text: 'Третья покупка в Nova Store — всегда быстро и без сюрпризов.' },
    { name: 'Елена П.', rating: 4, text: 'Удобно и красиво. Снизила оценку только за долгую доставку в регион.' },
  ];

  const productUi = { id: null, color: null, qty: 1, thumb: 0, tab: 'specs' };

  function reviewsFor(p) {
    const start = p.id.length % REVIEW_POOL.length;
    return [0, 1, 2].map((i) => REVIEW_POOL[(start + i) % REVIEW_POOL.length]);
  }

  function related(p) {
    return Nova.allProducts().filter((x) => x.id !== p.id)
      .sort((a, b) => (b.cat === p.cat) - (a.cat === p.cat) || b.sold - a.sold)
      .slice(0, 4);
  }

  Nova.views.product = {
    render(route) {
      const p = Nova.product(route.id);
      if (!p || p.hidden) {
        return html`<div class="container"><div class="empty"><span class="empty-icon">${raw(icon('box', 26))}</span><h3>Товар не найден</h3><p>Возможно, он снят с продажи.</p><a class="btn btn-primary" href="#/">В каталог</a></div></div>`;
      }
      if (productUi.id !== p.id) Object.assign(productUi, { id: p.id, color: p.colors[0], qty: 1, thumb: 0, tab: 'specs' });
      const palette = Nova.palette(p, productUi.color);
      const off = Nova.discountPercent(p);
      const fav = Nova.state.favs.includes(p.id);
      const cat = Nova.category(p.cat);
      const reviews = reviewsFor(p);

      return html`
        <div class="container product-page">
          <nav class="breadcrumbs" aria-label="Навигация">
            <a href="#/">Каталог</a><span>/</span>
            <a href="#/" data-action="filter-cat" data-cat="${p.cat}">${cat.name}</a><span>/</span>
            <span aria-current="page">${p.name}</span>
          </nav>

          <div class="product-layout">
            <div class="gallery">
              <div class="gallery-main" style="--glow:${palette[0]}">
                ${p.badge === 'new' || p.added >= 9 ? html`<span class="pill pill-accent gallery-badge">Новинка 2026</span>` : p.badge === 'hit' ? html`<span class="pill pill-accent gallery-badge">Хит продаж</span>` : ''}
                <button type="button" class="fav-btn${fav ? ' is-on' : ''}" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="В избранное">${raw(icon('heart', 18))}</button>
                <div class="gallery-art" id="gallery-art">${raw(Nova.art(p.kind, palette, { transform: THUMB_ANGLES[productUi.thumb].transform }))}</div>
              </div>
              <div class="thumbs" role="tablist" aria-label="Ракурсы">
                ${THUMB_ANGLES.map((a, i) => html`
                  <button type="button" class="thumb${i === productUi.thumb ? ' is-active' : ''}" role="tab" aria-selected="${i === productUi.thumb}" aria-label="${a.label}" data-action="thumb" data-index="${i}">
                    ${raw(Nova.art(p.kind, palette, { transform: a.transform }))}
                  </button>`)}
              </div>
            </div>

            <div class="product-info">
              ${p.stock > 0
                ? html`<span class="pill pill-success">${raw(icon('check', 13))} В наличии · ${p.stock} шт.</span>`
                : html`<span class="pill pill-danger">Нет в наличии</span>`}
              <h1>${p.name}</h1>
              <div class="product-rating">${raw(Nova.stars(p.rating, 15))}<span>${Nova.fmtDec(p.rating, 1)} · ${p.reviews} ${Nova.plural(p.reviews, 'отзыв', 'отзыва', 'отзывов')}</span></div>
              <div class="product-price">
                <span class="price-xl">${money(p.price)}</span>
                ${p.oldPrice ? html`<s class="old-price">${money(p.oldPrice)}</s><span class="pill pill-danger">−${off}%</span>` : ''}
              </div>
              <p class="product-desc">${p.desc}</p>

              <div class="swatches-block">
                <span class="muted">Цвет: <strong id="color-name">${D.COLORS[productUi.color].name}</strong></span>
                <div class="swatches" role="radiogroup" aria-label="Цвет">
                  ${p.colors.map((c) => html`
                    <button type="button" class="swatch${c === productUi.color ? ' is-active' : ''}" role="radio" aria-checked="${c === productUi.color}" aria-label="${D.COLORS[c].name}"
                      style="background:linear-gradient(135deg, ${D.COLORS[c].palette[0]}, ${D.COLORS[c].palette[1]})" data-action="color" data-color="${c}"></button>`)}
                </div>
              </div>

              <div class="buy-row">
                <div class="stepper" aria-label="Количество">
                  <button type="button" data-action="qty" data-delta="-1" aria-label="Меньше">${raw(icon('minus', 16))}</button>
                  <output id="qty-value">${productUi.qty}</output>
                  <button type="button" data-action="qty" data-delta="1" aria-label="Больше">${raw(icon('plus', 16))}</button>
                </div>
                <button type="button" class="btn btn-primary btn-lg buy-btn" data-action="add-product" ${p.stock > 0 ? '' : 'disabled'}>${raw(icon('cart', 18))} Добавить в корзину</button>
                <button type="button" class="icon-btn icon-btn-lg${fav ? ' is-on' : ''}" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="В избранное">${raw(icon('heart', 20))}</button>
              </div>

              <div class="perks">
                <div class="perk"><span class="perk-ico">${raw(icon('truck', 18))}</span><div><strong>Доставка завтра</strong><span>Бесплатно от ${money(Nova.state.settings.freeDeliveryFrom)}</span></div></div>
                <div class="perk"><span class="perk-ico">${raw(icon('shield', 18))}</span><div><strong>Гарантия 2 года</strong><span>Официальная</span></div></div>
                <div class="perk"><span class="perk-ico">${raw(icon('card', 18))}</span><div><strong>Сплит 4×${fmt(Math.ceil(p.price / 4))} ₽</strong><span>Без переплат</span></div></div>
              </div>
            </div>
          </div>

          <section class="product-tabs">
            <div class="tabs" role="tablist">
              <button type="button" role="tab" class="tab${productUi.tab === 'specs' ? ' is-active' : ''}" aria-selected="${productUi.tab === 'specs'}" data-action="tab" data-tab="specs">Характеристики</button>
              <button type="button" role="tab" class="tab${productUi.tab === 'reviews' ? ' is-active' : ''}" aria-selected="${productUi.tab === 'reviews'}" data-action="tab" data-tab="reviews">Отзывы · ${p.reviews}</button>
            </div>
            ${productUi.tab === 'specs'
              ? html`<dl class="specs">${Object.entries(p.specs || {}).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}<div><dt>Бренд</dt><dd>${p.brand}</dd></div><div><dt>Артикул</dt><dd class="mono">${p.id.toUpperCase()}</dd></div></dl>`
              : html`<div class="reviews">${reviews.map((r) => html`
                  <article class="review">
                    <header><span class="avatar avatar-sm">${Nova.initials(r.name)}</span><strong>${r.name}</strong>${raw(Nova.stars(r.rating, 12))}</header>
                    <p>${r.text}</p>
                  </article>`)}</div>`}
          </section>

          <section class="related">
            <h2>С этим покупают</h2>
            <div class="pgrid">${related(p).map(productCard)}</div>
          </section>
        </div>`;
    },

    onState() {
      document.querySelectorAll('.product-page [data-action="fav"]').forEach((b) => {
        const on = Nova.state.favs.includes(b.dataset.id);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
      });
    },
  };

  Nova.productUi = productUi;

  /* ------------------------------------------------------------------
     BRANDS
     ------------------------------------------------------------------ */
  Nova.views.brands = {
    render() {
      const byBrand = {};
      Nova.allProducts().forEach((p) => { (byBrand[p.brand] = byBrand[p.brand] || []).push(p); });
      const brands = Object.entries(byBrand).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
      return html`
        <div class="container page">
          <div class="catalog-head"><div><h1>Бренды</h1><p class="muted">${brands.length} ${Nova.plural(brands.length, 'бренд', 'бренда', 'брендов')} в Nova Store</p></div></div>
          <div class="brand-grid">
            ${brands.map(([name, items]) => html`
              <a class="brand-card" href="#/brand/${encodeURIComponent(name)}">
                <div class="brand-arts">${items.slice(0, 3).map((p) => raw(Nova.art(p.kind, Nova.palette(p))))}</div>
                <strong>${name}</strong>
                <span class="muted">${items.length} ${Nova.plural(items.length, 'товар', 'товара', 'товаров')} · от ${money(Math.min(...items.map((p) => p.price)))}</span>
              </a>`)}
          </div>
        </div>`;
    },
  };

  /* ------------------------------------------------------------------
     CART DRAWER
     ------------------------------------------------------------------ */
  Nova.renderCartDrawer = function renderCartDrawer() {
    const t = Nova.totals('courier');
    return html`
      <div class="drawer-head">
        <h2>Корзина <span class="muted">· ${t.count} ${Nova.plural(t.count, 'товар', 'товара', 'товаров')}</span></h2>
        <button type="button" class="icon-btn" data-action="close-cart" aria-label="Закрыть корзину">${raw(icon('x', 18))}</button>
      </div>
      ${t.lines.length ? html`
        <ul class="cart-lines">
          ${t.lines.map((l, i) => html`
            <li class="cart-line">
              <a href="#/p/${l.id}" class="line-art" data-action="close-cart">${raw(Nova.art(l.product.kind, Nova.palette(l.product, l.color)))}</a>
              <div class="line-info">
                <a href="#/p/${l.id}" data-action="close-cart"><strong>${l.product.name}</strong></a>
                <span class="muted">${D.COLORS[l.color] ? D.COLORS[l.color].name : ''} · ${money(l.product.price)}</span>
                <div class="stepper stepper-sm">
                  <button type="button" data-action="line-qty" data-index="${i}" data-delta="-1" aria-label="Меньше">${raw(icon('minus', 14))}</button>
                  <output>${l.qty}</output>
                  <button type="button" data-action="line-qty" data-index="${i}" data-delta="1" aria-label="Больше">${raw(icon('plus', 14))}</button>
                </div>
              </div>
              <div class="line-side">
                <strong>${money(l.sum)}</strong>
                <button type="button" class="link-btn" data-action="line-remove" data-index="${i}" aria-label="Удалить">${raw(icon('trash', 15))}</button>
              </div>
            </li>`)}
        </ul>
        <div class="drawer-foot">
          <div class="sum-row"><span class="muted">Товары</span><span>${money(t.subtotal)}</span></div>
          ${t.discount ? html`<div class="sum-row"><span class="muted">Скидка (${Nova.state.promo})</span><span class="text-success">−${money(t.discount)}</span></div>` : ''}
          <div class="sum-row sum-total"><span>Итого</span><strong>${money(t.subtotal - t.discount)}</strong></div>
          <a href="#/checkout" class="btn btn-primary btn-lg btn-block" data-action="close-cart">${raw(icon('lock', 17))} Оформить заказ</a>
          <button type="button" class="btn btn-ghost btn-block" data-action="close-cart">Продолжить покупки</button>
        </div>` : html`
        <div class="empty empty-drawer">
          <span class="empty-icon">${raw(icon('cart', 26))}</span>
          <h3>Корзина пуста</h3>
          <p>Добавьте товары из каталога — они появятся здесь.</p>
          <a href="#/" class="btn btn-primary" data-action="close-cart">В каталог</a>
        </div>`}`;
  };
})();
