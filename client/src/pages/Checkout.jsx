/**
 * Checkout: Корзина → Доставка → Оплата → Готово.
 * Card data is validated in the browser (Luhn, expiry) and never sent to the
 * API — only the payment method is. In production the card form would be the
 * payment provider's hosted fields returning a token.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, DELIVERY, luhn } from '@nova/shared';
import EmptyState from '../components/EmptyState.jsx';
import { Stepper } from '../components/CartDrawer.jsx';
import { Icon, ProductArt } from '../lib/icons.jsx';
import { money, paletteOf, plural } from '../lib/format.js';
import { useShop } from '../state/ShopContext.jsx';
import { api } from '../api/index.js';

const STEPS = ['Корзина', 'Доставка', 'Оплата', 'Готово'];
const SLOTS = ['10:00–14:00', '14:00–18:00', '18:00–22:00'];
const PICKUP_POINTS = [
  'Москва, ул. Тверская, 18 — Nova Point',
  'Москва, Ленинградский пр-т, 39 — ТЦ «Авиапарк»',
  'Москва, ул. Арбат, 24 — Nova Point',
];
const PAY = {
  card: { label: 'Банковская карта', icon: 'card' },
  sbp: { label: 'СБП', icon: 'zap' },
  split: { label: 'Сплит', icon: 'layers' },
};

const digits = (s) => String(s).replace(/\D/g, '');
const formatCard = (v) => digits(v).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExp = (v) => { const d = digits(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; };
const cardBrand = (n) => (/^220[0-4]/.test(n) ? 'МИР' : /^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : '');
const previewNumber = (n) => {
  const d = digits(n).padEnd(16, '•');
  return `${d.slice(0, 4)}  ${d.slice(4, 8).replace(/\d/g, '•')}  ${d.slice(8, 12).replace(/\d/g, '•')}  ${d.slice(12, 16)}`;
};

function validateCard(card) {
  const e = {};
  const num = digits(card.number);
  if (num.length !== 16 || !luhn(num)) e.number = 'Проверьте номер карты';
  if (!/^[A-Za-z][A-Za-z .'-]{1,}$/.test(card.holder.trim())) e.holder = 'Латиницей, как на карте';
  const exp = digits(card.exp);
  const mm = Number(exp.slice(0, 2));
  const yy = 2000 + Number(exp.slice(2, 4));
  const now = new Date();
  if (exp.length !== 4 || mm < 1 || mm > 12 || yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) e.exp = 'Неверный срок';
  if (digits(card.cvc).length !== 3) e.cvc = '3 цифры';
  return e;
}

function validateDelivery(contact, method) {
  const e = {};
  if (contact.name.trim().length < 2) e.name = 'Укажите имя';
  if (digits(contact.phone).length < 11) e.phone = 'Номер из 11 цифр';
  if (method !== 'pickup') {
    if (contact.city.trim().length < 2) e.city = 'Укажите город';
    if (contact.street.trim().length < 3) e.street = 'Укажите улицу и дом';
  }
  return e;
}

/** Decorative QR-like matrix for СБП (deterministic per amount). */
function QrCode({ seedText }) {
  const cells = useMemo(() => {
    let seed = 0;
    for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const n = 25;
    const out = [];
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
    return out;
  }, [seedText]);
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0b0b10" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0b0b10" />
    </g>
  );
  return (
    <svg viewBox="-2 -2 29 29" className="qr" role="img" aria-label="QR-код для оплаты через СБП">
      <rect x="-2" y="-2" width="29" height="29" fill="#fff" rx="2" />
      {cells.map(([x, y]) => <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill="#0b0b10" />)}
      {finder(0, 0)}{finder(18, 0)}{finder(0, 18)}
    </svg>
  );
}

function Field({ label, error, className = '', ...input }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <input className={`input${input.mono ? ' mono' : ''}${error ? ' is-invalid' : ''}`} aria-invalid={Boolean(error)} {...input} mono={undefined} />
      <small className="field-error">{error || ''}</small>
    </label>
  );
}

export default function Checkout() {
  const { lines, totals, setQty, promo, applyPromo, removePromo, clearCart, reloadCatalog, catalog, toast } = useShop();
  const [step, setStep] = useState(1);
  const [delivery, setDelivery] = useState('courier');
  const [slot, setSlot] = useState(SLOTS[0]);
  const [pickup, setPickup] = useState(PICKUP_POINTS[0]);
  const [contact, setContact] = useState({ name: 'Александра К.', phone: '+7 916 555-12-48', city: 'Москва', street: 'ул. Тверская, 12', apt: '48', comment: '' });
  const [pay, setPay] = useState('card');
  const [card, setCard] = useState({ number: '', holder: '', exp: '', cvc: '' });
  const [errors, setErrors] = useState({});
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState(null);
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => { document.title = 'Оформление заказа — Nova Store'; }, []);
  const t = totals(delivery);
  const go = (n) => { setErrors({}); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const setContactField = (key) => (e) => { setContact((c) => ({ ...c, [key]: e.target.value })); setErrors(({ [key]: _, ...rest }) => rest); };
  const setCardField = (key, format) => (e) => { setCard((c) => ({ ...c, [key]: format(e.target.value) })); setErrors(({ [key]: _, ...rest }) => rest); };

  const next = () => {
    if (step === 2) {
      const e = validateDelivery(contact, delivery);
      if (Object.keys(e).length) { setErrors(e); toast('Заполните обязательные поля', 'x'); return; }
    }
    go(step + 1);
  };

  const submitPromo = async (e) => {
    e.preventDefault();
    if (!promoInput.trim()) { setPromoMsg('Введите промокод'); return; }
    try {
      const res = await applyPromo(promoInput);
      if (!res.ok) setPromoMsg(res.message);
      else { setPromoMsg(null); setPromoInput(''); }
    } catch (err) { setPromoMsg(err.message); }
  };

  const payNow = async () => {
    if (pay === 'card') {
      const e = validateCard(card);
      if (Object.keys(e).length) { setErrors(e); toast('Проверьте данные карты', 'x'); return; }
    }
    setPaying(true);
    const address = delivery === 'pickup' ? pickup : `${contact.city}, ${contact.street}${contact.apt ? `, кв. ${contact.apt}` : ''}`;
    try {
      const order = await api.createOrder({
        customer: { name: contact.name.trim(), phone: contact.phone.trim() },
        delivery: { method: delivery, address, slot: delivery === 'courier' ? slot : undefined },
        payment: { method: pay },
        items: lines.map((l) => ({ id: l.id, color: l.color, qty: l.qty })),
        promo: promo ? promo.code : undefined,
      });
      const d = DELIVERY[delivery];
      setPlaced({
        ...order,
        palettes: Object.fromEntries(lines.map((l) => [`${l.id}|${l.color}`, { kind: l.product.kind, palette: paletteOf(l.product, l.color) }])),
        deliveryText: delivery === 'pickup' ? `Заберите заказ ${d.eta}: ${pickup}.` : `${d.label}: ${delivery === 'courier' ? `завтра, ${slot}` : d.eta}.`,
      });
      setCard({ number: '', holder: '', exp: '', cvc: '' });
      clearCart();
      reloadCatalog();
      toast(`Заказ #${order.id} оплачен`, 'check');
      go(4);
    } catch (err) {
      toast(err.message, 'x');
    } finally {
      setPaying(false);
    }
  };

  const stepper = (
    <ol className="steps" aria-label="Этапы оформления">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        const inner = <><span className="step-num">{state === 'done' ? <Icon name="check" size={13} /> : n}</span>{label}</>;
        return (
          <li key={label} className={`step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {n < step && step < 4 ? <button type="button" className="step-btn" onClick={() => go(n)}>{inner}</button> : <span className="step-btn">{inner}</span>}
          </li>
        );
      })}
    </ol>
  );

  if (step === 4 && placed) {
    return (
      <div className="container checkout checkout-done">
        {stepper}
        <section className="panel done">
          <span className="done-icon"><Icon name="check" size={34} /></span>
          <h2>Заказ #{placed.id} оформлен</h2>
          <p className="muted">Мы отправили подтверждение на почту. {placed.deliveryText}</p>
          <div className="done-items">
            {placed.items.map((i) => {
              const art = placed.palettes[`${i.id}|${i.color}`] || {};
              return <div className="done-item" key={`${i.id}-${i.color}`}><ProductArt kind={art.kind} palette={art.palette} /><span>{i.name} × {i.qty}</span><strong>{money(i.sum)}</strong></div>;
            })}
          </div>
          <div className="sum-row sum-total"><span>Оплачено · {placed.payment}</span><strong>{money(placed.total)}</strong></div>
          <div className="done-actions">
            <Link to="/" className="btn btn-primary">Вернуться в магазин</Link>
            <Link to="/admin/orders" className="btn btn-ghost"><Icon name="chart" size={16} /> Посмотреть в админке</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="container checkout">
        <EmptyState icon="cart" title="Корзина пуста" text="Добавьте товары, чтобы оформить заказ.">
          <Link className="btn btn-primary" to="/">В каталог</Link>
        </EmptyState>
      </div>
    );
  }

  const num = digits(card.number);
  const action = {
    1: { label: 'Перейти к доставке', icon: 'truck', run: next },
    2: { label: 'Перейти к оплате', icon: 'card', run: next },
    3: { label: paying ? 'Проводим платёж…' : 'Оплатить заказ', icon: 'lock', run: payNow },
  }[step];

  return (
    <div className="container checkout">
      <div className="checkout-main">
        {stepper}

        {step === 1 && (
          <section className="panel">
            <div className="panel-head"><h2>Корзина</h2><span className="muted">{t.count} {plural(t.count, 'товар', 'товара', 'товаров')}</span></div>
            <ul className="cart-lines cart-lines-wide">
              {lines.map((l) => (
                <li className="cart-line" key={`${l.id}-${l.color}`}>
                  <Link to={`/p/${l.id}`} className="line-art"><ProductArt kind={l.product.kind} palette={paletteOf(l.product, l.color)} /></Link>
                  <div className="line-info"><Link to={`/p/${l.id}`}><strong>{l.product.name}</strong></Link><span className="muted">{COLORS[l.color]?.name} · {money(l.product.price)} / шт.</span></div>
                  <Stepper small value={l.qty} onChange={(q) => setQty(l.index, q)} />
                  <div className="line-side"><strong>{money(l.sum)}</strong><button type="button" className="link-btn" aria-label="Удалить" onClick={() => setQty(l.index, 0)}><Icon name="trash" size={15} /></button></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 2 && (
          <>
            <section className="panel">
              <h2>Получатель</h2>
              <div className="form-grid">
                <Field label="Имя и фамилия" name="name" autoComplete="name" value={contact.name} onChange={setContactField('name')} error={errors.name} />
                <Field label="Телефон" name="phone" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={setContactField('phone')} error={errors.phone} />
              </div>
            </section>
            <section className="panel">
              <h2>Способ получения</h2>
              <div className="option-list" role="radiogroup" aria-label="Способ получения">
                {Object.entries(DELIVERY).map(([key, d]) => {
                  const free = key !== 'express' && t.subtotal - t.discount >= catalog.settings.freeDeliveryFrom;
                  const price = d.price === 0 || free ? 'Бесплатно' : money(d.price);
                  return (
                    <label key={key} className={`option${delivery === key ? ' is-active' : ''}`}>
                      <input type="radio" name="delivery" value={key} checked={delivery === key} onChange={() => setDelivery(key)} />
                      <span className="option-ico"><Icon name={key === 'pickup' ? 'store' : key === 'express' ? 'zap' : 'truck'} /></span>
                      <span className="option-text"><strong>{d.label}</strong><span className="muted">{d.eta}</span></span>
                      <span className={`pill ${price === 'Бесплатно' ? 'pill-success' : 'pill-muted'}`}>{price}</span>
                    </label>
                  );
                })}
              </div>
              {delivery === 'pickup' ? (
                <label className="field"><span>Пункт выдачи</span>
                  <select className="input" value={pickup} onChange={(e) => setPickup(e.target.value)}>{PICKUP_POINTS.map((p) => <option key={p}>{p}</option>)}</select>
                </label>
              ) : (
                <>
                  <div className="form-grid form-grid-3">
                    <Field label="Город" name="city" autoComplete="address-level2" value={contact.city} onChange={setContactField('city')} error={errors.city} />
                    <Field label="Улица, дом" name="street" className="span-2" autoComplete="street-address" value={contact.street} onChange={setContactField('street')} error={errors.street} />
                    <Field label="Квартира" name="apt" value={contact.apt} onChange={setContactField('apt')} />
                    <Field label="Комментарий курьеру" name="comment" className="span-2" placeholder="Код домофона, этаж…" value={contact.comment} onChange={setContactField('comment')} />
                  </div>
                  {delivery === 'courier' && (
                    <div className="slot-block">
                      <span className="muted">Интервал доставки завтра</span>
                      <div className="chips">{SLOTS.map((s) => <button key={s} type="button" className={`chip${slot === s ? ' is-active' : ''}`} onClick={() => setSlot(s)}>{s}</button>)}</div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <section className="panel">
              <h2>Способ оплаты</h2>
              <div className="pay-methods" role="radiogroup" aria-label="Способ оплаты">
                {Object.entries(PAY).map(([k, m]) => (
                  <button key={k} type="button" role="radio" aria-checked={pay === k} className={`pay-method${pay === k ? ' is-active' : ''}`} onClick={() => { setPay(k); setErrors({}); }}>
                    <Icon name={m.icon} /> {m.label}
                  </button>
                ))}
              </div>

              {pay === 'card' && (
                <div className="card-pay">
                  <div className="bank-card" aria-hidden="true">
                    <span className="bank-chip" />
                    <span className="bank-brand">{cardBrand(num)}</span>
                    <span className="bank-number">{previewNumber(num)}</span>
                    <div className="bank-bottom"><span>{card.holder || 'ИМЯ ВЛАДЕЛЬЦА'}</span><span>{formatExp(card.exp).replace(/\s/g, '') || 'ММ/ГГ'}</span></div>
                  </div>
                  <div className="card-fields">
                    <Field label="Номер карты" mono inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={19} value={card.number} onChange={setCardField('number', formatCard)} error={errors.number} />
                    <Field label="Имя владельца" mono autoComplete="cc-name" placeholder="ALEXANDRA K." value={card.holder} onChange={setCardField('holder', (v) => v.replace(/[^A-Za-z .'-]/g, '').toUpperCase())} error={errors.holder} />
                    <div className="form-grid">
                      <Field label="Срок" mono inputMode="numeric" autoComplete="cc-exp" placeholder="ММ / ГГ" maxLength={7} value={card.exp} onChange={setCardField('exp', formatExp)} error={errors.exp} />
                      <Field label="CVC" mono type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={3} value={card.cvc} onChange={setCardField('cvc', (v) => digits(v).slice(0, 3))} error={errors.cvc} />
                    </div>
                    <button type="button" className="link-btn" onClick={() => { setCard({ number: '4242 4242 4242 4242', holder: 'ALEXANDRA K.', exp: '08 / 29', cvc: '123' }); setErrors({}); }}>
                      <Icon name="sparkle" size={14} /> Заполнить тестовой картой
                    </button>
                  </div>
                </div>
              )}

              {pay === 'sbp' && (
                <div className="sbp">
                  <QrCode seedText={`nova-${t.total}`} />
                  <div>
                    <strong>Оплата через Систему быстрых платежей</strong>
                    <p className="muted">Отсканируйте QR-код камерой телефона или в приложении банка и подтвердите платёж на {money(t.total)}. Комиссия — 0 ₽.</p>
                    <p className="muted">После нажатия «Оплатить заказ» платёж подтвердится автоматически (демо-режим).</p>
                  </div>
                </div>
              )}

              {pay === 'split' && (
                <div className="split">
                  <p className="muted">4 платежа без переплат — первый сегодня, остальные раз в две недели.</p>
                  <ol className="split-plan">
                    {[0, 1, 2, 3].map((i) => {
                      const d = new Date();
                      d.setDate(d.getDate() + i * 14);
                      const part = i < 3 ? Math.floor(t.total / 4) : t.total - Math.floor(t.total / 4) * 3;
                      return <li key={i} className={i === 0 ? 'is-now' : ''}><span className="split-dot" /><strong>{money(part)}</strong><span className="muted">{i === 0 ? 'сегодня' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span></li>;
                    })}
                  </ol>
                </div>
              )}
            </section>

            <section className="panel delivery-card">
              <span className="option-ico"><Icon name={delivery === 'pickup' ? 'store' : 'truck'} /></span>
              <div className="option-text">
                <strong>{DELIVERY[delivery].label} · {delivery === 'courier' ? `завтра, ${slot}` : DELIVERY[delivery].eta}</strong>
                <span className="muted">{delivery === 'pickup' ? pickup : `${contact.city}, ${contact.street}${contact.apt ? `, кв. ${contact.apt}` : ''}`}</span>
              </div>
              <span className={`pill ${t.delivery ? 'pill-muted' : 'pill-success'}`}>{t.delivery ? money(t.delivery) : 'Бесплатно'}</span>
              <button type="button" className="link-btn" onClick={() => go(2)}>Изменить</button>
            </section>
          </>
        )}
      </div>

      <aside className="panel summary" aria-label="Ваш заказ">
        <h2>Ваш заказ · {t.count} {plural(t.count, 'товар', 'товара', 'товаров')}</h2>
        <ul className="summary-lines">
          {lines.map((l) => (
            <li key={`${l.id}-${l.color}`}>
              <span className="summary-art"><ProductArt kind={l.product.kind} palette={paletteOf(l.product, l.color)} /></span>
              <span className="summary-name"><strong>{l.product.name}</strong><span className="muted">{l.qty} шт.</span></span>
              <strong>{money(l.sum)}</strong>
            </li>
          ))}
        </ul>

        {promo ? (
          <div className="promo-applied">
            <span><Icon name="percent" size={15} /> <strong>{promo.code}</strong> · {promo.label}</span>
            <button type="button" className="link-btn" onClick={removePromo} aria-label="Убрать промокод"><Icon name="x" size={14} /></button>
          </div>
        ) : (
          <>
            <form className="promo-form" onSubmit={submitPromo}>
              <input className="input mono" name="promo" placeholder="Промокод" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} aria-label="Промокод" autoComplete="off" />
              <button type="submit" className="btn btn-ghost">Применить</button>
            </form>
            {promoMsg ? <small className="field-error">{promoMsg}</small> : <small className="muted hint">Попробуйте SOUND20 или NOVA10</small>}
          </>
        )}

        <div className="sum-rows">
          <div className="sum-row"><span className="muted">Товары</span><span>{money(t.subtotal)}</span></div>
          <div className="sum-row"><span className="muted">Скидка по промокоду</span><span className={t.discount ? 'text-success' : ''}>{t.discount ? `−${money(t.discount)}` : '0 ₽'}</span></div>
          <div className="sum-row"><span className="muted">Доставка</span><span>{money(t.delivery)}</span></div>
          <div className="sum-row sum-total"><span>Итого</span><strong className="total-xl">{money(t.total)}</strong></div>
        </div>

        <button type="button" className={`btn btn-primary btn-lg btn-block${paying ? ' is-loading' : ''}`} onClick={action.run} disabled={paying}>
          <Icon name={action.icon} size={17} /> {action.label}
        </button>
        <p className="secure-note">Платёж защищён · 3-D Secure · PCI DSS</p>
      </aside>
    </div>
  );
}
