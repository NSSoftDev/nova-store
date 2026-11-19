/* ==========================================================================
   Nova Store — checkout.js
   --------------------------------------------------------------------------
   Four-step checkout: Корзина → Доставка → Оплата → Готово.
     • editable cart lines
     • contact + delivery form (courier / express / pickup, time slots)
     • payment: bank card with live card preview, brand detection, Luhn and
       expiry validation; СБП with a generated QR; Сплит with a 4-payment
       schedule
     • promo codes (SOUND20 / NOVA10), free-delivery threshold from admin
     • placing the order stores it, so it immediately shows up in the admin
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});
  const D = Nova.data;
  const { html, raw, icon, money } = Nova;

  const STEPS = ['Корзина', 'Доставка', 'Оплата', 'Готово'];
  const SLOTS = ['10:00–14:00', '14:00–18:00', '18:00–22:00'];
  const PICKUP_POINTS = [
    'Москва, ул. Тверская, 18 — Nova Point',
    'Москва, Ленинградский пр-т, 39 — ТЦ «Авиапарк»',
    'Москва, ул. Арбат, 24 — Nova Point',
  ];
  const PAY_METHODS = {
    card: { label: 'Банковская карта', icon: 'card', short: 'Карта' },
    sbp: { label: 'СБП', icon: 'zap', short: 'СБП' },
    split: { label: 'Сплит', icon: 'layers', short: 'Сплит' },
  };

  /* Checkout form state survives re-renders (kept in memory, not storage) */
  const co = {
    step: 1,
    delivery: 'courier',
    slot: SLOTS[0],
    pickup: PICKUP_POINTS[0],
    contact: { name: 'Александра К.', phone: '+7 916 555-12-48', city: 'Москва', street: 'ул. Тверская, 12', apt: '48', comment: '' },
    pay: 'card',
    card: { number: '', holder: '', exp: '', cvc: '' },
    errors: {},
    promoInput: '',
    promoMsg: null,
    paying: false,
    placed: null,
  };
  Nova.checkout = co;

  /* ------------------------------------------------------------------
     Card helpers
     ------------------------------------------------------------------ */
  const digits = (s) => String(s).replace(/\D/g, '');

  function luhn(num) {
    let sum = 0;
    let dbl = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = Number(num[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return num.length >= 13 && sum % 10 === 0;
  }

  function cardBrand(num) {
    if (/^220[0-4]/.test(num)) return 'МИР';
    if (/^4/.test(num)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
    return '';
  }

  const formatCardNumber = (v) => digits(v).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExp = (v) => {
    const d = digits(v).slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
  };

  /** Masked number for the card preview: first 4 + last 4 visible. */
  function previewNumber(num) {
    const d = digits(num).padEnd(16, '•');
    return `${d.slice(0, 4)}  ${d.slice(4, 8).replace(/\d/g, '•')}  ${d.slice(8, 12).replace(/\d/g, '•')}  ${d.slice(12, 16)}`;
  }

  function validateCard() {
    const e = {};
    const num = digits(co.card.number);
    if (!luhn(num) || num.length !== 16) e.number = 'Проверьте номер карты';
    if (!/^[A-Za-z][A-Za-z .'-]{1,}$/.test(co.card.holder.trim())) e.holder = 'Латиницей, как на карте';
    const exp = digits(co.card.exp);
    const mm = Number(exp.slice(0, 2));
    const yy = Number(exp.slice(2, 4));
    const now = new Date();
    const expired = 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
    if (exp.length !== 4 || mm < 1 || mm > 12 || expired) e.exp = 'Неверный срок';
    if (digits(co.card.cvc).length !== 3) e.cvc = '3 цифры';
    return e;
  }

  function validateDelivery() {
    const e = {};
    const c = co.contact;
    if (c.name.trim().length < 2) e.name = 'Укажите имя';
    if (digits(c.phone).length < 11) e.phone = 'Номер из 11 цифр';
    if (co.delivery !== 'pickup') {
      if (c.city.trim().length < 2) e.city = 'Укажите город';
      if (c.street.trim().length < 3) e.street = 'Укажите улицу и дом';
    }
    return e;
  }

  /* ------------------------------------------------------------------
     Tiny deterministic QR-like matrix for the СБП option (visual only)
     ------------------------------------------------------------------ */
  function qrSvg(seedText) {
    const n = 25;
    let seed = 0;
    for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let cells = '';
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#0b0b10"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0b0b10"/>`;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!inFinder(x, y) && rand() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#0b0b10"/>`;
      }
    }
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" class="qr" role="img" aria-label="QR-код для оплаты через СБП"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff" rx="2"/>${cells}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
  }

  /* ------------------------------------------------------------------
     Markup pieces
     ------------------------------------------------------------------ */
  function stepper() {
    return html`
      <ol class="steps" aria-label="Этапы оформления">
        ${STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < co.step ? 'done' : n === co.step ? 'current' : 'todo';
          const clickable = n < co.step && co.step < 4;
          return html`
            <li class="step is-${state}" ${state === 'current' ? 'aria-current="step"' : ''}>
              ${clickable ? html`<button type="button" class="step-btn" data-action="co-step" data-step="${n}">` : html`<span class="step-btn">`}
                <span class="step-num">${state === 'done' ? raw(icon('check', 13)) : n}</span>${label}
              ${clickable ? raw('</button>') : raw('</span>')}
            </li>`;
        })}
      </ol>`;
  }

  const field = (name, label, value, opts) => {
    const o = opts || {};
    const err = co.errors[name];
    return html`
      <label class="field${o.cls ? ` ${o.cls}` : ''}">
        <span>${label}</span>
        <input class="input${o.mono ? ' mono' : ''}${err ? ' is-invalid' : ''}" name="${name}" value="${value}" data-co="${o.group || 'contact'}"
          ${o.placeholder ? raw(`placeholder="${Nova.esc(o.placeholder)}"`) : ''} ${o.inputmode ? raw(`inputmode="${o.inputmode}"`) : ''}
          ${o.type ? raw(`type="${o.type}"`) : ''} ${o.max ? raw(`maxlength="${o.max}"`) : ''} autocomplete="${o.autocomplete || 'off'}" aria-invalid="${!!err}" />
        <small class="field-error" data-error="${name}">${err || ''}</small>
      </label>`;
  };

  function stepCart(t) {
    return html`
      <section class="panel">
        <div class="panel-head"><h2>Корзина</h2><span class="muted">${t.count} ${Nova.plural(t.count, 'товар', 'товара', 'товаров')}</span></div>
        <ul class="cart-lines cart-lines-wide">
          ${t.lines.map((l, i) => html`
            <li class="cart-line">
              <a href="#/p/${l.id}" class="line-art">${raw(Nova.art(l.product.kind, Nova.palette(l.product, l.color)))}</a>
              <div class="line-info">
                <a href="#/p/${l.id}"><strong>${l.product.name}</strong></a>
                <span class="muted">${D.COLORS[l.color] ? D.COLORS[l.color].name : ''} · ${money(l.product.price)} / шт.</span>
              </div>
              <div class="stepper stepper-sm">
                <button type="button" data-action="line-qty" data-index="${i}" data-delta="-1" aria-label="Меньше">${raw(icon('minus', 14))}</button>
                <output>${l.qty}</output>
                <button type="button" data-action="line-qty" data-index="${i}" data-delta="1" aria-label="Больше">${raw(icon('plus', 14))}</button>
              </div>
              <div class="line-side"><strong>${money(l.sum)}</strong><button type="button" class="link-btn" data-action="line-remove" data-index="${i}" aria-label="Удалить">${raw(icon('trash', 15))}</button></div>
            </li>`)}
        </ul>
      </section>`;
  }

  function stepDelivery(t) {
    const c = co.contact;
    return html`
      <section class="panel">
        <h2>Получатель</h2>
        <div class="form-grid">
          ${field('name', 'Имя и фамилия', c.name, { autocomplete: 'name' })}
          ${field('phone', 'Телефон', c.phone, { inputmode: 'tel', autocomplete: 'tel' })}
        </div>
      </section>

      <section class="panel">
        <h2>Способ получения</h2>
        <div class="option-list" role="radiogroup" aria-label="Способ получения">
          ${Object.entries(D.DELIVERY).map(([key, d]) => {
            const free = key !== 'express' && t.subtotal - t.discount >= Nova.state.settings.freeDeliveryFrom;
            const price = d.price === 0 || free ? 'Бесплатно' : money(d.price);
            return html`
              <label class="option${co.delivery === key ? ' is-active' : ''}">
                <input type="radio" name="delivery" value="${key}" data-co="delivery" ${co.delivery === key ? 'checked' : ''} />
                <span class="option-ico">${raw(icon(key === 'pickup' ? 'store' : key === 'express' ? 'zap' : 'truck', 18))}</span>
                <span class="option-text"><strong>${d.label}</strong><span class="muted">${d.eta}</span></span>
                <span class="pill ${price === 'Бесплатно' ? 'pill-success' : 'pill-muted'}">${price}</span>
              </label>`;
          })}
        </div>

        ${co.delivery === 'pickup' ? html`
          <label class="field"><span>Пункт выдачи</span>
            <select class="input" data-co="pickup">${PICKUP_POINTS.map((p) => html`<option ${p === co.pickup ? 'selected' : ''}>${p}</option>`)}</select>
          </label>` : html`
          <div class="form-grid form-grid-3">
            ${field('city', 'Город', c.city, { autocomplete: 'address-level2' })}
            ${field('street', 'Улица, дом', c.street, { autocomplete: 'street-address', cls: 'span-2' })}
            ${field('apt', 'Квартира', c.apt)}
            ${field('comment', 'Комментарий курьеру', c.comment, { placeholder: 'Код домофона, этаж…', cls: 'span-2' })}
          </div>
          ${co.delivery === 'courier' ? html`
            <div class="slot-block">
              <span class="muted">Интервал доставки завтра</span>
              <div class="chips">${SLOTS.map((s) => html`<button type="button" class="chip${co.slot === s ? ' is-active' : ''}" data-action="co-slot" data-slot="${s}">${s}</button>`)}</div>
            </div>` : ''}`}
      </section>`;
  }

  function deliverySummaryCard(t) {
    const d = D.DELIVERY[co.delivery];
    const where = co.delivery === 'pickup' ? co.pickup : `${co.contact.city}, ${co.contact.street}${co.contact.apt ? `, кв. ${co.contact.apt}` : ''}`;
    const when = co.delivery === 'courier' ? `завтра, ${co.slot}` : d.eta;
    return html`
      <section class="panel delivery-card">
        <span class="option-ico">${raw(icon(co.delivery === 'pickup' ? 'store' : 'truck', 18))}</span>
        <div class="option-text"><strong>${d.label} · ${when}</strong><span class="muted">${where}</span></div>
        <span class="pill ${t.delivery ? 'pill-muted' : 'pill-success'}">${t.delivery ? money(t.delivery) : 'Бесплатно'}</span>
        <button type="button" class="link-btn" data-action="co-step" data-step="2">Изменить</button>
      </section>`;
  }

  function stepPayment(t) {
    const num = digits(co.card.number);
    const brand = cardBrand(num);
    return html`
      <section class="panel">
        <h2>Способ оплаты</h2>
        <div class="pay-methods" role="radiogroup" aria-label="Способ оплаты">
          ${Object.entries(PAY_METHODS).map(([k, m]) => html`
            <button type="button" class="pay-method${co.pay === k ? ' is-active' : ''}" role="radio" aria-checked="${co.pay === k}" data-action="co-pay" data-pay="${k}">${raw(icon(m.icon, 18))} ${m.label}</button>`)}
        </div>

        ${co.pay === 'card' ? html`
          <div class="card-pay">
            <div class="bank-card" aria-hidden="true">
              <span class="bank-chip"></span>
              <span class="bank-brand" id="card-brand">${brand}</span>
              <span class="bank-number" id="card-preview-number">${previewNumber(num)}</span>
              <div class="bank-bottom">
                <span id="card-preview-holder">${co.card.holder.toUpperCase() || 'ИМЯ ВЛАДЕЛЬЦА'}</span>
                <span id="card-preview-exp">${formatExp(co.card.exp).replace(/\s/g, '') || 'ММ/ГГ'}</span>
              </div>
            </div>
            <div class="card-fields">
              ${field('number', 'Номер карты', co.card.number, { group: 'card', mono: true, inputmode: 'numeric', placeholder: '0000 0000 0000 0000', autocomplete: 'cc-number', max: 19 })}
              ${field('holder', 'Имя владельца', co.card.holder, { group: 'card', mono: true, placeholder: 'ALEXANDRA K.', autocomplete: 'cc-name' })}
              <div class="form-grid">
                ${field('exp', 'Срок', co.card.exp, { group: 'card', mono: true, inputmode: 'numeric', placeholder: 'ММ / ГГ', autocomplete: 'cc-exp', max: 7 })}
                ${field('cvc', 'CVC', co.card.cvc, { group: 'card', mono: true, inputmode: 'numeric', placeholder: '•••', autocomplete: 'cc-csc', type: 'password', max: 3 })}
              </div>
              <button type="button" class="link-btn" data-action="co-test-card">${raw(icon('sparkle', 14))} Заполнить тестовой картой</button>
            </div>
          </div>` : ''}

        ${co.pay === 'sbp' ? html`
          <div class="sbp">
            ${raw(qrSvg(`nova-${t.total}`))}
            <div>
              <strong>Оплата через Систему быстрых платежей</strong>
              <p class="muted">Отсканируйте QR-код камерой телефона или в приложении банка и подтвердите платёж на ${money(t.total)}. Комиссия — 0 ₽.</p>
              <p class="muted">После нажатия «Оплатить заказ» платёж подтвердится автоматически (демо-режим).</p>
            </div>
          </div>` : ''}

        ${co.pay === 'split' ? html`
          <div class="split">
            <p class="muted">4 платежа без переплат — первый сегодня, остальные раз в две недели.</p>
            <ol class="split-plan">
              ${[0, 1, 2, 3].map((i) => {
                const d = new Date();
                d.setDate(d.getDate() + i * 14);
                const part = i < 3 ? Math.floor(t.total / 4) : t.total - Math.floor(t.total / 4) * 3;
                return html`<li class="${i === 0 ? 'is-now' : ''}"><span class="split-dot"></span><strong>${money(part)}</strong><span class="muted">${i === 0 ? 'сегодня' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span></li>`;
              })}
            </ol>
          </div>` : ''}
      </section>
      ${deliverySummaryCard(t)}`;
  }

  function stepDone() {
    const o = co.placed;
    return html`
      <section class="panel done">
        <span class="done-icon">${raw(icon('check', 34))}</span>
        <h2>Заказ #${o.id} оформлен</h2>
        <p class="muted">Мы отправили подтверждение на почту. ${o.deliveryText}</p>
        <div class="done-items">
          ${o.items.map((i) => html`<div class="done-item">${raw(Nova.art(i.kind, i.palette))}<span>${i.name} × ${i.qty}</span><strong>${money(i.sum)}</strong></div>`)}
        </div>
        <div class="sum-row sum-total"><span>Оплачено · ${o.payment}</span><strong>${money(o.total)}</strong></div>
        <div class="done-actions">
          <a href="#/" class="btn btn-primary">Вернуться в магазин</a>
          <a href="#/admin/orders" class="btn btn-ghost">${raw(icon('chart', 16))} Посмотреть в админке</a>
        </div>
      </section>`;
  }

  function summary(t) {
    const btn = {
      1: { label: 'Перейти к доставке', icon: 'truck', action: 'co-next' },
      2: { label: 'Перейти к оплате', icon: 'card', action: 'co-next' },
      3: { label: co.paying ? 'Проводим платёж…' : 'Оплатить заказ', icon: 'lock', action: 'co-pay-submit' },
    }[co.step];
    return html`
      <aside class="panel summary" aria-label="Ваш заказ">
        <h2>Ваш заказ · ${t.count} ${Nova.plural(t.count, 'товар', 'товара', 'товаров')}</h2>
        <ul class="summary-lines">
          ${t.lines.map((l) => html`
            <li>
              <span class="summary-art">${raw(Nova.art(l.product.kind, Nova.palette(l.product, l.color)))}</span>
              <span class="summary-name"><strong>${l.product.name}</strong><span class="muted">${l.qty} шт.</span></span>
              <strong>${money(l.sum)}</strong>
            </li>`)}
        </ul>

        ${Nova.state.promo ? html`
          <div class="promo-applied">
            <span>${raw(icon('percent', 15))} <strong>${Nova.state.promo}</strong> · ${Nova.promoDef(Nova.state.promo) ? Nova.promoDef(Nova.state.promo).label : ''}</span>
            <button type="button" class="link-btn" data-action="promo-remove" aria-label="Убрать промокод">${raw(icon('x', 14))}</button>
          </div>` : html`
          <form class="promo-form" data-form="promo">
            <input class="input mono" name="promo" placeholder="Промокод" value="${co.promoInput}" data-co="promo" aria-label="Промокод" autocomplete="off" />
            <button type="submit" class="btn btn-ghost">Применить</button>
          </form>
          ${co.promoMsg ? html`<small class="field-error">${co.promoMsg}</small>` : html`<small class="muted hint">Попробуйте SOUND20 или NOVA10</small>`}`}

        <div class="sum-rows">
          <div class="sum-row"><span class="muted">Товары</span><span>${money(t.subtotal)}</span></div>
          <div class="sum-row"><span class="muted">Скидка по промокоду</span><span class="${t.discount ? 'text-success' : ''}">${t.discount ? `−${money(t.discount)}` : '0 ₽'}</span></div>
          <div class="sum-row"><span class="muted">Доставка</span><span>${money(t.delivery)}</span></div>
          <div class="sum-row sum-total"><span>Итого</span><strong class="total-xl">${money(t.total)}</strong></div>
        </div>

        <button type="button" class="btn btn-primary btn-lg btn-block${co.paying ? ' is-loading' : ''}" data-action="${btn.action}" ${co.paying ? 'disabled' : ''}>${raw(icon(btn.icon, 17))} ${btn.label}</button>
        <p class="secure-note">Платёж защищён · 3-D Secure · PCI DSS</p>
      </aside>`;
  }

  /* ------------------------------------------------------------------
     View
     ------------------------------------------------------------------ */
  Nova.views = Nova.views || {};

  Nova.views.checkout = {
    render() {
      const t = Nova.totals(co.delivery);
      if (co.step === 4 && co.placed) {
        return html`<div class="container checkout checkout-done">${stepper()}${stepDone()}</div>`;
      }
      if (!t.lines.length) {
        co.step = 1;
        return html`
          <div class="container checkout">
            <div class="empty"><span class="empty-icon">${raw(icon('cart', 26))}</span><h3>Корзина пуста</h3><p>Добавьте товары, чтобы оформить заказ.</p><a class="btn btn-primary" href="#/">В каталог</a></div>
          </div>`;
      }
      return html`
        <div class="container checkout">
          <div class="checkout-main">
            ${stepper()}
            ${co.step === 1 ? stepCart(t) : ''}
            ${co.step === 2 ? stepDelivery(t) : ''}
            ${co.step === 3 ? stepPayment(t) : ''}
          </div>
          ${summary(t)}
        </div>`;
    },

    onState() { Nova.rerender(); },

    /** Form typing: update state + live card preview without re-rendering. */
    onInput(e) {
      const t = e.target;
      const group = t.dataset.co;
      if (!group) return;
      if (group === 'contact') {
        co.contact[t.name] = t.value;
        clearError(t);
      } else if (group === 'card') {
        let v = t.value;
        if (t.name === 'number') v = formatCardNumber(v);
        if (t.name === 'exp') v = formatExp(v);
        if (t.name === 'cvc') v = digits(v).slice(0, 3);
        if (t.name === 'holder') v = v.replace(/[^A-Za-z .'-]/g, '').toUpperCase();
        if (v !== t.value) t.value = v;
        co.card[t.name] = v;
        clearError(t);
        updateCardPreview();
      } else if (group === 'delivery' && e.type === 'change') {
        co.delivery = t.value;
        Nova.rerender();
      } else if (group === 'pickup') {
        co.pickup = t.value;
      } else if (group === 'promo') {
        co.promoInput = t.value;
      }
    },
  };

  function clearError(input) {
    if (!co.errors[input.name]) return;
    delete co.errors[input.name];
    input.classList.remove('is-invalid');
    input.setAttribute('aria-invalid', 'false');
    const msg = document.querySelector(`[data-error="${input.name}"]`);
    if (msg) msg.textContent = '';
  }

  function updateCardPreview() {
    const num = digits(co.card.number);
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('card-preview-number', previewNumber(num));
    set('card-preview-holder', co.card.holder || 'ИМЯ ВЛАДЕЛЬЦА');
    set('card-preview-exp', formatExp(co.card.exp).replace(/\s/g, '') || 'ММ/ГГ');
    set('card-brand', cardBrand(num));
  }

  /* ------------------------------------------------------------------
     Actions (dispatched from app.js)
     ------------------------------------------------------------------ */
  Nova.checkoutActions = {
    'co-step'(el) {
      co.step = Number(el.dataset.step);
      co.errors = {};
      Nova.rerender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    'co-next'() {
      if (co.step === 2) {
        co.errors = validateDelivery();
        if (Object.keys(co.errors).length) { Nova.rerender(); Nova.toast('Заполните обязательные поля', 'x'); return; }
      }
      co.step += 1;
      Nova.rerender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    'co-slot'(el) { co.slot = el.dataset.slot; Nova.rerender(); },
    'co-pay'(el) { co.pay = el.dataset.pay; co.errors = {}; Nova.rerender(); },
    'co-test-card'() {
      co.card = { number: '4242 4242 4242 4242', holder: 'ALEXANDRA K.', exp: '08 / 29', cvc: '123' };
      co.errors = {};
      Nova.rerender();
    },
    'promo-remove'() {
      co.promoMsg = null;
      Nova.update((s) => { s.promo = null; });
    },
    'co-pay-submit'() {
      if (co.paying) return;
      if (co.pay === 'card') {
        co.errors = validateCard();
        if (Object.keys(co.errors).length) { Nova.rerender(); Nova.toast('Проверьте данные карты', 'x'); return; }
      }
      co.paying = true;
      Nova.rerender();
      // Simulated payment gateway round-trip (3-D Secure etc.)
      setTimeout(placeOrder, 1400);
    },
  };

  /** Applies a promo code from the summary form. */
  Nova.applyPromo = function applyPromo(code) {
    const res = Nova.checkPromo(code);
    if (!res.ok) { co.promoMsg = res.message; Nova.rerender(); return; }
    co.promoMsg = null;
    co.promoInput = '';
    Nova.update((s) => { s.promo = String(code).trim().toUpperCase(); });
    Nova.toast(`Промокод применён: ${res.message}`, 'percent');
  };

  function placeOrder() {
    const t = Nova.totals(co.delivery);
    const d = D.DELIVERY[co.delivery];
    const order = {
      id: Nova.nextOrderId(),
      customer: co.contact.name.trim() || 'Покупатель',
      total: t.total,
      payment: PAY_METHODS[co.pay].short,
      status: 'processing',
      date: new Date().toISOString(),
      promo: Nova.state.promo,
      items: t.lines.map((l) => ({ id: l.id, name: l.product.name, qty: l.qty, sum: l.sum, kind: l.product.kind, palette: Nova.palette(l.product, l.color) })),
    };
    co.placed = {
      ...order,
      deliveryText: co.delivery === 'pickup' ? `Заберите заказ ${d.eta}: ${co.pickup}.` : `${d.label}: ${co.delivery === 'courier' ? `завтра, ${co.slot}` : d.eta}.`,
    };
    co.paying = false;
    co.step = 4;
    co.card = { number: '', holder: '', exp: '', cvc: '' };
    Nova.update((s) => {
      s.orders.unshift(order);
      // decrease stock for purchased items (visible in admin → Товары)
      t.lines.forEach((l) => {
        const edit = s.productEdits[l.id] || {};
        edit.stock = Math.max(0, (edit.stock !== undefined ? edit.stock : l.product.stock) - l.qty);
        s.productEdits[l.id] = edit;
      });
      s.cart = [];
      s.promo = null;
    });
    Nova.toast(`Заказ #${order.id} оплачен`, 'check');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Called by the router when leaving/re-entering checkout after success. */
  Nova.resetCheckoutIfDone = function resetCheckoutIfDone() {
    if (co.step === 4) { co.step = 1; co.placed = null; }
  };
})();
