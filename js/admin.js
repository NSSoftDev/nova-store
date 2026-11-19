/* ==========================================================================
   Nova Store — admin.js  ("Nova Admin")
   --------------------------------------------------------------------------
   Back-office views that read and write the same state as the storefront:
     • Обзор     — KPIs vs previous period, revenue chart with hover
                   tooltip (current vs previous), top products, latest orders
     • Заказы    — status filter, search, inline status change
     • Товары    — inline price / stock edit, hide from store, new product
     • Клиенты   — customers aggregated from orders
     • Продажи   — revenue by category, payment-method mix
     • Маркетинг — promo codes on/off (affects checkout instantly)
     • Настройки — free-delivery threshold, demo reset
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});
  const D = Nova.data;
  const { html, raw, icon, money, fmt } = Nova;

  const RANGES = {
    '12d': { label: '1–12 ноября', days: 12 },
    '7d': { label: 'Последние 7 дней', days: 7 },
    '30d': { label: 'Последние 30 дней', days: 30 },
  };
  const admin = { range: '12d', orderFilter: 'all', orderQuery: '', rangeOpen: false };

  const NAV = [
    { section: 'Магазин' },
    { id: 'overview', label: 'Обзор', icon: 'home', href: '#/admin' },
    { id: 'orders', label: 'Заказы', icon: 'box', href: '#/admin/orders' },
    { id: 'products', label: 'Товары', icon: 'tag', href: '#/admin/products' },
    { id: 'customers', label: 'Клиенты', icon: 'users', href: '#/admin/customers' },
    { section: 'Аналитика' },
    { id: 'sales', label: 'Продажи', icon: 'chart', href: '#/admin/sales' },
    { id: 'marketing', label: 'Маркетинг', icon: 'trending', href: '#/admin/marketing' },
    { id: 'settings', label: 'Настройки', icon: 'settings', href: '#/admin/settings' },
  ];

  /* ------------------------------------------------------------------
     Shell
     ------------------------------------------------------------------ */
  Nova.renderAdminShell = function renderAdminShell() {
    return html`
      <div class="admin">
        <aside class="admin-side" id="admin-side">
          <a href="#/admin" class="brand"><span class="brand-mark">${raw(icon('cart', 18))}</span><span class="brand-name">Nova Admin</span></a>
          <nav aria-label="Разделы администратора">
            ${NAV.map((n) => (n.section
              ? html`<p class="side-label">${n.section}</p>`
              : html`<a href="${n.href}" class="side-link" data-admin-nav="${n.id}">${raw(icon(n.icon, 18))}<span>${n.label}</span></a>`))}
          </nav>
          <a href="#/" class="side-store">${raw(icon('store', 18))}<span>Открыть магазин</span>${raw(icon('chevronRight', 16))}</a>
        </aside>
        <main class="admin-main" id="view" tabindex="-1"></main>
      </div>
      <div class="modal-host" id="modal-host"></div>`;
  };

  Nova.syncAdminNav = (id) => {
    document.querySelectorAll('[data-admin-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.adminNav === id));
  };

  const pageHead = (title, sub, actions) => html`
    <header class="page-head">
      <div><h1>${title}</h1><p class="muted">${sub}</p></div>
      <div class="page-actions">${actions || ''}</div>
    </header>`;

  const statusPill = (status) => {
    const s = D.ORDER_STATUSES[status] || D.ORDER_STATUSES.processing;
    return html`<span class="pill pill-${s.tone}">${s.label}</span>`;
  };

  const delta = (value, invert) => {
    const up = value >= 0;
    const good = invert ? !up : up;
    return html`<span class="delta ${good ? 'is-good' : 'is-bad'}">${up ? '▲' : '▼'} ${Nova.fmtDec(Math.abs(value), 1)}%</span>`;
  };

  /* ------------------------------------------------------------------
     Metrics
     ------------------------------------------------------------------ */
  function periodStats(days, offset) {
    const h = D.HISTORY;
    const slice = h.slice(h.length - days - offset, h.length - offset);
    const revenue = slice.reduce((s, d) => s + d.revenue, 0);
    const orders = slice.reduce((s, d) => s + d.orders, 0);
    const returns = slice.reduce((s, d) => s + d.returnsRate, 0) / slice.length;
    return { slice, revenue, orders, returns };
  }

  function currentStats() {
    const days = RANGES[admin.range].days;
    const cur = periodStats(days, 0);
    const prev = periodStats(days, days);
    // Orders placed by the visitor in this browser count towards "today"
    const live = Nova.state.orders;
    const liveRevenue = live.reduce((s, o) => s + o.total, 0);
    cur.revenue += liveRevenue;
    cur.orders += live.length;
    const series = cur.slice.map((d) => d.revenue);
    series[series.length - 1] += liveRevenue;
    return {
      revenue: cur.revenue,
      orders: cur.orders,
      avg: cur.revenue / cur.orders,
      returns: cur.returns,
      d: {
        revenue: ((cur.revenue - prev.revenue) / prev.revenue) * 100,
        orders: ((cur.orders - prev.orders) / prev.orders) * 100,
        avg: ((cur.revenue / cur.orders - prev.revenue / prev.orders) / (prev.revenue / prev.orders)) * 100,
        returns: ((cur.returns - prev.returns) / prev.returns) * 100,
      },
      series,
      prevSeries: prev.slice.map((d) => d.revenue),
      dates: cur.slice.map((d) => d.date),
    };
  }

  function soldMap() {
    const sold = {};
    Nova.allProducts(true).forEach((p) => { sold[p.id] = p.sold || 0; });
    Nova.state.orders.forEach((o) => (o.items || []).forEach((i) => { sold[i.id] = (sold[i.id] || 0) + i.qty; }));
    return sold;
  }

  /* ------------------------------------------------------------------
     Revenue chart (SVG, responsive, hover tooltip)
     ------------------------------------------------------------------ */
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const t = 0.18;
      d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  function revenueChart(stats) {
    const W = 760, H = 230, PAD_T = 14, PAD_B = 26;
    const all = stats.series.concat(stats.prevSeries);
    const max = Math.max(...all) * 1.08;
    const min = Math.min(...all) * 0.82;
    const x = (i, n) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);
    const cur = stats.series.map((v, i) => [x(i, stats.series.length), y(v)]);
    const prev = stats.prevSeries.map((v, i) => [x(i, stats.prevSeries.length), y(v)]);
    const line = smoothPath(cur);
    const area = `${line} L${W},${H - PAD_B} L0,${H - PAD_B} Z`;
    const last = cur[cur.length - 1];
    const labelEvery = Math.ceil(stats.dates.length / 6);
    const lastIdx = stats.dates.length - 1;
    // every Nth date + the last one, skipping labels that would collide with it
    const labels = stats.dates.map((d, i) => ((i % labelEvery === 0 && lastIdx - i >= labelEvery * 0.6) || i === lastIdx
      ? `<span style="left:${(x(i, stats.dates.length) / W) * 100}%">${new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}</span>` : '')).join('');
    const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${W}" y1="${PAD_T + f * (H - PAD_T - PAD_B)}" y2="${PAD_T + f * (H - PAD_T - PAD_B)}" class="grid-line"/>`).join('');

    return html`
      <div class="chart" data-chart="revenue" data-points="${JSON.stringify({ cur: stats.series, prev: stats.prevSeries, dates: stats.dates })}">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".45"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient>
          </defs>
          ${raw(grid)}
          <path d="${smoothPath(prev)}" class="line-prev" vector-effect="non-scaling-stroke"/>
          <path d="${area}" fill="url(#rev-fill)"/>
          <path d="${line}" class="line-cur" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="chart-dot" style="left:${(last[0] / W) * 100}%;top:${(last[1] / H) * 100}%"></span>
        <span class="chart-cursor" hidden></span>
        <div class="chart-tip" hidden></div>
        <div class="chart-x">${raw(labels)}</div>
      </div>`;
  }

  /** Hover handler for the revenue chart (attached via app.js pointermove). */
  Nova.chartHover = function chartHover(e) {
    const chart = e.target.closest('[data-chart="revenue"]');
    if (!chart) return;
    const data = JSON.parse(chart.dataset.points);
    const rect = chart.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = Math.round(ratio * (data.cur.length - 1));
    const cursor = chart.querySelector('.chart-cursor');
    const tip = chart.querySelector('.chart-tip');
    const left = (i / (data.cur.length - 1)) * 100;
    cursor.hidden = false;
    tip.hidden = false;
    cursor.style.left = `${left}%`;
    tip.style.left = `${Math.min(82, Math.max(4, left))}%`;
    const rawDate = new Date(data.dates[i]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    const date = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
    tip.innerHTML = `<strong>${Nova.esc(date)}</strong><span><i class="lg lg-cur"></i>${money(data.cur[i])}</span><span><i class="lg lg-prev"></i>${money(data.prev[i] || 0)}</span>`;
  };
  Nova.chartLeave = function chartLeave(e) {
    const chart = e.target.closest('[data-chart="revenue"]');
    if (!chart) return;
    chart.querySelector('.chart-cursor').hidden = true;
    chart.querySelector('.chart-tip').hidden = true;
  };

  /* ------------------------------------------------------------------
     Views
     ------------------------------------------------------------------ */
  Nova.adminViews = {};

  Nova.adminViews.overview = function overview() {
    const s = currentStats();
    const sold = soldMap();
    const top = Nova.allProducts(true).sort((a, b) => sold[b.id] - sold[a.id]).slice(0, 5);
    const topMax = sold[top[0].id];
    const recent = Nova.allOrders().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return html`
      ${pageHead('Обзор продаж', 'Ноябрь 2026 · все каналы', html`
        <div class="range-picker">
          <button type="button" class="btn btn-ghost" data-action="range-toggle" aria-haspopup="menu" aria-expanded="${admin.rangeOpen}">${raw(icon('calendar', 16))} ${RANGES[admin.range].label}</button>
          <div class="menu" role="menu" ${admin.rangeOpen ? '' : 'hidden'}>
            ${Object.entries(RANGES).map(([k, r]) => html`<button type="button" role="menuitemradio" aria-checked="${k === admin.range}" data-action="range-set" data-range="${k}">${k === admin.range ? raw(icon('check', 15)) : raw('<span class="ico-space"></span>')} ${r.label}</button>`)}
          </div>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-product">${raw(icon('plus', 16))} Новый товар</button>`)}

      <div class="kpis">
        <article class="kpi"><div class="kpi-top"><span>Выручка</span><span class="kpi-ico">${raw(icon('card', 17))}</span></div><strong>${Nova.compactMoney(s.revenue)}</strong>${delta(s.d.revenue)}<span class="muted"> к прошлому периоду</span></article>
        <article class="kpi"><div class="kpi-top"><span>Заказы</span><span class="kpi-ico">${raw(icon('box', 17))}</span></div><strong>${fmt(s.orders)}</strong>${delta(s.d.orders)}<span class="muted"> к прошлому периоду</span></article>
        <article class="kpi"><div class="kpi-top"><span>Средний чек</span><span class="kpi-ico">${raw(icon('tag', 17))}</span></div><strong>${money(s.avg)}</strong>${delta(s.d.avg)}<span class="muted"> к прошлому периоду</span></article>
        <article class="kpi"><div class="kpi-top"><span>Возвраты</span><span class="kpi-ico">${raw(icon('truck', 17))}</span></div><strong>${Nova.fmtDec(s.returns, 1)}%</strong>${delta(s.d.returns, true)}<span class="muted"> к прошлому периоду</span></article>
      </div>

      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head">
            <h2>Выручка по дням</h2>
            <div class="legend"><span><i class="lg lg-cur"></i>Текущий период</span><span><i class="lg lg-prev"></i>Предыдущий</span></div>
          </div>
          ${revenueChart(s)}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Топ товаров</h2><a href="#/admin/products" class="link-btn">Все</a></div>
          <ul class="top-list">
            ${top.map((p) => html`
              <li>
                <a href="#/p/${p.id}" class="top-art" title="Открыть в магазине">${raw(Nova.art(p.kind, Nova.palette(p)))}</a>
                <div class="top-body">
                  <div class="top-row"><span>${p.name}</span><strong>${fmt(sold[p.id])}</strong></div>
                  <div class="bar"><span style="width:${(sold[p.id] / topMax) * 100}%"></span></div>
                </div>
              </li>`)}
          </ul>
        </section>
      </div>

      <section class="panel">
        <div class="panel-head"><h2>Последние заказы</h2><a href="#/admin/orders" class="link-btn">Все заказы</a></div>
        ${ordersTable(recent, false)}
      </section>`;
  };

  function ordersTable(orders, editable) {
    if (!orders.length) return html`<div class="empty empty-sm"><p>Заказов не найдено.</p></div>`;
    return html`
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Заказ</th><th>Клиент</th><th>Дата</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead>
          <tbody>
            ${orders.map((o) => html`
              <tr class="${Nova.state.orders.some((x) => x.id === o.id) ? 'is-new' : ''}">
                <td class="mono">#${o.id}</td>
                <td><span class="person"><span class="avatar avatar-sm">${Nova.initials(o.customer)}</span>${o.customer}</span></td>
                <td class="muted">${new Date(o.date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td><strong>${money(o.total)}</strong></td>
                <td class="muted">${o.payment}</td>
                <td>${editable ? html`
                  <select class="input input-sm status-select tone-${D.ORDER_STATUSES[o.status].tone}" data-admin="status" data-id="${o.id}" aria-label="Статус заказа ${o.id}">
                    ${Object.entries(D.ORDER_STATUSES).map(([k, st]) => html`<option value="${k}" ${k === o.status ? 'selected' : ''}>${st.label}</option>`)}
                  </select>` : statusPill(o.status)}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>`;
  }

  Nova.adminViews.orders = function orders() {
    const all = Nova.allOrders().sort((a, b) => b.date.localeCompare(a.date));
    const q = admin.orderQuery.trim().toLowerCase();
    const list = all
      .filter((o) => admin.orderFilter === 'all' || o.status === admin.orderFilter)
      .filter((o) => !q || `${o.id} ${o.customer}`.toLowerCase().includes(q));
    const count = (st) => all.filter((o) => o.status === st).length;
    return html`
      ${pageHead('Заказы', `${all.length} ${Nova.plural(all.length, 'заказ', 'заказа', 'заказов')} · новые из витрины отмечены`)}
      <div class="toolbar">
        <div class="chips">
          <button type="button" class="chip${admin.orderFilter === 'all' ? ' is-active' : ''}" data-action="order-filter" data-status="all">Все · ${all.length}</button>
          ${Object.entries(D.ORDER_STATUSES).map(([k, s]) => html`<button type="button" class="chip${admin.orderFilter === k ? ' is-active' : ''}" data-action="order-filter" data-status="${k}">${s.label} · ${count(k)}</button>`)}
        </div>
        <label class="search search-sm">${raw(icon('search', 16))}<input type="search" placeholder="Номер или клиент" value="${admin.orderQuery}" data-admin="order-search" aria-label="Поиск заказов" /></label>
      </div>
      <section class="panel" id="orders-panel">${ordersTable(list, true)}</section>`;
  };

  Nova.adminViews.products = function products() {
    const sold = soldMap();
    const list = Nova.allProducts(true);
    return html`
      ${pageHead('Товары', `${list.length} ${Nova.plural(list.length, 'товар', 'товара', 'товаров')} · цена и остаток редактируются прямо в таблице`, html`<button type="button" class="btn btn-primary" data-action="new-product">${raw(icon('plus', 16))} Новый товар</button>`)}
      <section class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Товар</th><th>Категория</th><th>Цена, ₽</th><th>Остаток</th><th>Продано</th><th>На витрине</th></tr></thead>
            <tbody>
              ${list.map((p) => html`
                <tr class="${p.hidden ? 'is-muted' : ''}">
                  <td><a href="#/p/${p.id}" class="product-cell"><span class="top-art">${raw(Nova.art(p.kind, Nova.palette(p)))}</span><span><strong>${p.name}</strong><span class="muted mono">${p.id}</span></span></a></td>
                  <td class="muted">${Nova.category(p.cat).name}</td>
                  <td><input class="input input-sm mono num-input" type="number" min="1" step="10" value="${p.price}" data-admin="price" data-id="${p.id}" aria-label="Цена ${p.name}" /></td>
                  <td><input class="input input-sm mono num-input${p.stock < 15 ? ' is-low' : ''}" type="number" min="0" step="1" value="${p.stock}" data-admin="stock" data-id="${p.id}" aria-label="Остаток ${p.name}" /></td>
                  <td>${fmt(sold[p.id] || 0)}</td>
                  <td><label class="toggle"><input type="checkbox" data-admin="visible" data-id="${p.id}" ${p.hidden ? '' : 'checked'} /><span></span></label></td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </section>`;
  };

  Nova.adminViews.customers = function customers() {
    const map = {};
    Nova.allOrders().forEach((o) => {
      const c = (map[o.customer] = map[o.customer] || { name: o.customer, orders: 0, spent: 0, last: o.date });
      c.orders += 1;
      if (o.status !== 'returned') c.spent += o.total;
      if (o.date > c.last) c.last = o.date;
    });
    const list = Object.values(map).sort((a, b) => b.spent - a.spent);
    return html`
      ${pageHead('Клиенты', `${list.length} ${Nova.plural(list.length, 'клиент', 'клиента', 'клиентов')} с заказами`)}
      <section class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Клиент</th><th>Заказов</th><th>Сумма покупок</th><th>Последний заказ</th><th>Сегмент</th></tr></thead>
            <tbody>
              ${list.map((c) => html`
                <tr>
                  <td><span class="person"><span class="avatar avatar-sm">${Nova.initials(c.name)}</span>${c.name}</span></td>
                  <td>${c.orders}</td>
                  <td><strong>${money(c.spent)}</strong></td>
                  <td class="muted">${new Date(c.last).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</td>
                  <td>${c.spent >= 30000 ? html`<span class="pill pill-accent">VIP</span>` : c.orders > 1 ? html`<span class="pill pill-info">Постоянный</span>` : html`<span class="pill pill-muted">Новый</span>`}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </section>`;
  };

  Nova.adminViews.sales = function sales() {
    const sold = soldMap();
    const byCat = D.CATEGORIES.map((c) => ({
      ...c,
      revenue: Nova.allProducts(true).filter((p) => p.cat === c.id).reduce((s, p) => s + p.price * (sold[p.id] || 0), 0),
    })).sort((a, b) => b.revenue - a.revenue);
    const maxCat = byCat[0].revenue || 1;
    const totalCat = byCat.reduce((s, c) => s + c.revenue, 0) || 1;
    const orders = Nova.allOrders();
    const byPay = ['Карта', 'СБП', 'Сплит'].map((m) => ({ m, n: orders.filter((o) => o.payment === m).length }));
    const payTotal = byPay.reduce((s, p) => s + p.n, 0) || 1;
    const colors = ['#8b5cf6', '#5b8cff', '#22d3ee'];
    let acc = 0;
    const donut = byPay.map((p, i) => {
      const from = (acc / payTotal) * 100;
      acc += p.n;
      return `${colors[i]} ${from}% ${(acc / payTotal) * 100}%`;
    }).join(', ');
    return html`
      ${pageHead('Продажи', 'Структура выручки за месяц')}
      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head"><h2>Выручка по категориям</h2></div>
          <ul class="cat-bars">
            ${byCat.map((c) => html`
              <li>
                <div class="top-row"><span>${c.name}</span><span><strong>${Nova.compactMoney(c.revenue)}</strong> <span class="muted">· ${Nova.fmtDec((c.revenue / totalCat) * 100, 1)}%</span></span></div>
                <div class="bar bar-lg"><span style="width:${(c.revenue / maxCat) * 100}%"></span></div>
              </li>`)}
          </ul>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Способы оплаты</h2></div>
          <div class="donut-wrap">
            <div class="donut" style="background:conic-gradient(${donut})"><div><strong>${orders.length}</strong><span>заказов</span></div></div>
            <ul class="donut-legend">${byPay.map((p, i) => html`<li><i style="background:${colors[i]}"></i>${p.m}<strong>${Nova.fmtDec((p.n / payTotal) * 100, 1)}%</strong></li>`)}</ul>
          </div>
        </section>
      </div>`;
  };

  Nova.adminViews.marketing = function marketing() {
    const orders = Nova.allOrders();
    return html`
      ${pageHead('Маркетинг', 'Промокоды применяются в корзине покупателя сразу после включения')}
      <section class="panel">
        <div class="panel-head"><h2>Промокоды</h2></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Код</th><th>Условие</th><th>Применений</th><th>Активен</th></tr></thead>
            <tbody>
              ${Object.entries(D.PROMOS).map(([code, p]) => {
                const active = Nova.state.promoState[code] !== undefined ? Nova.state.promoState[code] : p.active;
                return html`
                  <tr>
                    <td><button type="button" class="code-chip" data-action="copy-promo" data-code="${code}">${code} ${raw(icon('copy', 13))}</button></td>
                    <td>${p.label}</td>
                    <td>${orders.filter((o) => o.promo === code).length}</td>
                    <td><label class="toggle"><input type="checkbox" data-admin="promo" data-code="${code}" ${active ? 'checked' : ''} /><span></span></label></td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel promo-banner">
        <div><h2>Баннер «−20% на аудио»</h2><p class="muted">Показывается в фильтрах каталога. Клик копирует промокод SOUND20.</p></div>
        <a href="#/" class="btn btn-ghost">${raw(icon('store', 16))} Посмотреть на витрине</a>
      </section>`;
  };

  Nova.adminViews.settings = function settings() {
    const st = Nova.state.settings;
    return html`
      ${pageHead('Настройки', 'Параметры магазина')}
      <section class="panel settings">
        <label class="field">
          <span>Бесплатная доставка курьером от, ₽</span>
          <input class="input mono" type="number" min="0" step="500" value="${st.freeDeliveryFrom}" data-admin="free-delivery" />
          <small class="muted">Сейчас: ${money(st.freeDeliveryFrom)}. Значение сразу используется в корзине и на странице товара.</small>
        </label>
        <div class="settings-row">
          <div><strong>Демо-данные</strong><p class="muted">Вернуть корзину, заказы, товары и настройки к исходному состоянию.</p></div>
          <button type="button" class="btn btn-danger" data-action="reset-demo">${raw(icon('refresh', 16))} Сбросить</button>
        </div>
      </section>`;
  };

  /* ------------------------------------------------------------------
     New product modal
     ------------------------------------------------------------------ */
  const KINDS = {
    headphones: 'Наушники', earbuds: 'TWS-наушники', watch: 'Часы', speaker: 'Колонка', camera: 'Камера', keyboard: 'Клавиатура',
    sneaker: 'Кроссовки', backpack: 'Рюкзак', lamp: 'Лампа', bottle: 'Бутылка', hoodie: 'Худи', dumbbell: 'Гантели', mug: 'Кружка', sunglasses: 'Очки',
  };

  Nova.openProductModal = function openProductModal() {
    const host = document.getElementById('modal-host');
    host.innerHTML = html`
      <div class="modal-backdrop" data-action="modal-close"></div>
      <form class="modal" data-form="new-product" role="dialog" aria-modal="true" aria-labelledby="np-title">
        <div class="modal-head"><h2 id="np-title">Новый товар</h2><button type="button" class="icon-btn" data-action="modal-close" aria-label="Закрыть">${raw(icon('x', 18))}</button></div>
        <div class="np-preview" id="np-preview">${raw(Nova.art('headphones', D.COLORS.lavender.palette))}</div>
        <label class="field"><span>Название</span><input class="input" name="name" required minlength="3" placeholder="Например, Наушники Aura Lite" /></label>
        <div class="form-grid">
          <label class="field"><span>Категория</span><select class="input" name="cat">${D.CATEGORIES.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></label>
          <label class="field"><span>Иллюстрация</span><select class="input" name="kind" data-np="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
          <label class="field"><span>Цвет</span><select class="input" name="color" data-np="color">${Object.entries(D.COLORS).map(([k, c]) => html`<option value="${k}">${c.name}</option>`)}</select></label>
          <label class="field"><span>Цена, ₽</span><input class="input mono" name="price" type="number" min="100" step="10" required value="4990" /></label>
          <label class="field"><span>Остаток, шт.</span><input class="input mono" name="stock" type="number" min="0" step="1" required value="25" /></label>
          <label class="field"><span>Аудиотовар (SOUND20)</span><select class="input" name="audio"><option value="0">Нет</option><option value="1">Да</option></select></label>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-action="modal-close">Отмена</button>
          <button type="submit" class="btn btn-primary">${raw(icon('plus', 16))} Добавить в каталог</button>
        </div>
      </form>`.value;
    host.querySelector('input[name="name"]').focus();
  };

  Nova.closeModal = () => { const host = document.getElementById('modal-host'); if (host) host.innerHTML = ''; };

  Nova.updateProductPreview = function updateProductPreview(form) {
    const kind = form.querySelector('[name="kind"]').value;
    const color = form.querySelector('[name="color"]').value;
    form.querySelector('#np-preview').innerHTML = Nova.art(kind, D.COLORS[color].palette);
  };

  Nova.createProduct = function createProduct(form) {
    const f = new FormData(form);
    const name = String(f.get('name')).trim();
    const slug = name.toLowerCase()
      .replace(/[а-яё]/g, (ch) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }[ch]))
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
    const id = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const color = String(f.get('color'));
    const product = {
      id, name, brand: name.split(/\s+/)[1] || 'Nova', cat: String(f.get('cat')), kind: String(f.get('kind')),
      price: Math.max(100, Number(f.get('price'))), rating: 5, reviews: 0, badge: 'new', audio: f.get('audio') === '1',
      stock: Math.max(0, Number(f.get('stock'))), sold: 0, added: 99, colors: [color, ...['lavender', 'graphite'].filter((c) => c !== color)],
      desc: 'Новый товар, добавленный через Nova Admin. Описание можно расширить в карточке товара.',
      specs: { 'Категория': Nova.category(String(f.get('cat'))).name },
    };
    // Close first: the admin view only re-renders on state change when no modal is open
    Nova.closeModal();
    Nova.update((s) => { s.customProducts.unshift(product); });
    Nova.toast(`«${name}» добавлен в каталог`, 'check');
  };

  /* ------------------------------------------------------------------
     Admin actions + inputs (dispatched from app.js)
     ------------------------------------------------------------------ */
  Nova.adminActions = {
    'range-toggle'() { admin.rangeOpen = !admin.rangeOpen; Nova.rerender(); },
    'range-set'(el) { admin.range = el.dataset.range; admin.rangeOpen = false; Nova.rerender(); },
    'order-filter'(el) { admin.orderFilter = el.dataset.status; Nova.rerender(); },
    'new-product'() { Nova.openProductModal(); },
    'modal-close'() { Nova.closeModal(); },
  };

  Nova.adminInput = function adminInput(e) {
    const t = e.target;
    const kind = t.dataset.admin;
    if (t.dataset.np && e.type === 'change') { Nova.updateProductPreview(t.form); return; }
    if (!kind) return;
    if (kind === 'order-search') {
      admin.orderQuery = t.value;
      // re-render only the table so the search field keeps focus
      const panel = document.getElementById('orders-panel');
      const all = Nova.allOrders().sort((a, b) => b.date.localeCompare(a.date));
      const q = admin.orderQuery.trim().toLowerCase();
      const list = all.filter((o) => (admin.orderFilter === 'all' || o.status === admin.orderFilter) && (!q || `${o.id} ${o.customer}`.toLowerCase().includes(q)));
      panel.innerHTML = ordersTable(list, true).value;
      return;
    }
    if (e.type !== 'change') return; // numbers/toggles commit on change
    if (kind === 'status') {
      Nova.update((s) => { s.orderStatus[t.dataset.id] = t.value; });
      Nova.toast(`Заказ #${t.dataset.id}: ${D.ORDER_STATUSES[t.value].label}`, 'box');
    } else if (kind === 'price' || kind === 'stock') {
      const v = Math.max(kind === 'price' ? 1 : 0, Math.round(Number(t.value) || 0));
      Nova.update((s) => { s.productEdits[t.dataset.id] = Object.assign(s.productEdits[t.dataset.id] || {}, { [kind]: v }); });
      Nova.toast(kind === 'price' ? `Цена обновлена: ${money(v)}` : `Остаток обновлён: ${v} шт.`, 'tag');
    } else if (kind === 'visible') {
      Nova.update((s) => { s.productEdits[t.dataset.id] = Object.assign(s.productEdits[t.dataset.id] || {}, { hidden: !t.checked }); });
      Nova.toast(t.checked ? 'Товар снова на витрине' : 'Товар скрыт с витрины', 'store');
    } else if (kind === 'promo') {
      Nova.update((s) => {
        s.promoState[t.dataset.code] = t.checked;
        if (!t.checked && s.promo === t.dataset.code) s.promo = null;
      });
      Nova.toast(`${t.dataset.code} ${t.checked ? 'включён' : 'выключен'}`, 'percent');
    } else if (kind === 'free-delivery') {
      const v = Math.max(0, Math.round(Number(t.value) || 0));
      Nova.update((s) => { s.settings.freeDeliveryFrom = v; });
      Nova.toast(`Бесплатная доставка от ${money(v)}`, 'truck');
    }
  };
})();
