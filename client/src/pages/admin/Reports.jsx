/**
 * Клиенты, Продажи, Маркетинг, Настройки.
 */
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';
import { compactMoney, fmtDec, formatDate, initials, money, plural } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { useShop } from '../../state/ShopContext.jsx';
import { api } from '../../api/index.js';
import { Async, PageHead, Toggle } from './common.jsx';

const SEGMENTS = {
  vip: <span className="pill pill-accent">VIP</span>,
  regular: <span className="pill pill-info">Постоянный</span>,
  new: <span className="pill pill-muted">Новый</span>,
};

export function Customers() {
  const { onUnauthorized } = useOutletContext();
  const customers = useApi(() => api.customers(), []);
  return (
    <Async state={customers} onUnauthorized={onUnauthorized}>
      {(list) => (
        <>
          <PageHead title="Клиенты" sub={`${list.length} ${plural(list.length, 'клиент', 'клиента', 'клиентов')} с заказами`} />
          <section className="panel">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Клиент</th><th>Заказов</th><th>Сумма покупок</th><th>Последний заказ</th><th>Сегмент</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.name}>
                      <td><span className="person"><span className="avatar avatar-sm">{initials(c.name)}</span>{c.name}</span></td>
                      <td>{c.orders}</td>
                      <td><strong>{money(c.spent)}</strong></td>
                      <td className="muted">{formatDate(c.lastOrderAt, { day: 'numeric', month: 'long' })}</td>
                      <td>{SEGMENTS[c.segment]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Async>
  );
}

const PAY_COLORS = ['#8b5cf6', '#5b8cff', '#22d3ee'];

export function Sales() {
  const { onUnauthorized } = useOutletContext();
  const sales = useApi(() => api.sales(), []);
  return (
    <Async state={sales} onUnauthorized={onUnauthorized}>
      {(s) => {
        const maxCat = s.byCategory[0].revenue || 1;
        const totalCat = s.byCategory.reduce((sum, c) => sum + c.revenue, 0) || 1;
        const payTotal = s.byPayment.reduce((sum, p) => sum + p.orders, 0) || 1;
        let acc = 0;
        const donut = s.byPayment.map((p, i) => {
          const from = (acc / payTotal) * 100;
          acc += p.orders;
          return `${PAY_COLORS[i]} ${from}% ${(acc / payTotal) * 100}%`;
        }).join(', ');
        return (
          <>
            <PageHead title="Продажи" sub="Структура выручки за месяц" />
            <div className="admin-grid">
              <section className="panel">
                <div className="panel-head"><h2>Выручка по категориям</h2></div>
                <ul className="cat-bars">
                  {s.byCategory.map((c) => (
                    <li key={c.id}>
                      <div className="top-row"><span>{c.name}</span><span><strong>{compactMoney(c.revenue)}</strong> <span className="muted">· {fmtDec((c.revenue / totalCat) * 100, 1)}%</span></span></div>
                      <div className="bar bar-lg"><span style={{ width: `${(c.revenue / maxCat) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel">
                <div className="panel-head"><h2>Способы оплаты</h2></div>
                <div className="donut-wrap">
                  <div className="donut" style={{ background: `conic-gradient(${donut})` }}><div><strong>{s.totalOrders}</strong><span>заказов</span></div></div>
                  <ul className="donut-legend">
                    {s.byPayment.map((p, i) => <li key={p.method}><i style={{ background: PAY_COLORS[i] }} />{p.method}<strong>{fmtDec((p.orders / payTotal) * 100, 1)}%</strong></li>)}
                  </ul>
                </div>
              </section>
            </div>
          </>
        );
      }}
    </Async>
  );
}

export function Marketing() {
  const { onUnauthorized } = useOutletContext();
  const { toast, promo, removePromo } = useShop();
  const promos = useApi(() => api.promos(), []);
  const orders = useApi(() => api.orders(), []);

  const toggle = async (p, active) => {
    try {
      await api.setPromoActive(p.code, active);
      promos.setData((list) => list.map((x) => (x.code === p.code ? { ...x, active } : x)));
      if (!active && promo && promo.code === p.code) removePromo();
      toast(`${p.code} ${active ? 'включён' : 'выключен'}`, 'percent');
    } catch (err) { toast(err.message, 'x'); }
  };
  const copy = (code) => { navigator.clipboard?.writeText(code).catch(() => {}); toast(`Промокод ${code} скопирован`, 'copy'); };

  return (
    <>
      <PageHead title="Маркетинг" sub="Промокоды применяются в корзине покупателя сразу после включения" />
      <section className="panel">
        <div className="panel-head"><h2>Промокоды</h2></div>
        <Async state={promos} onUnauthorized={onUnauthorized}>
          {(list) => (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Код</th><th>Условие</th><th>Применений</th><th>Активен</th></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.code}>
                      <td><button type="button" className="code-chip" onClick={() => copy(p.code)}>{p.code} <Icon name="copy" size={13} /></button></td>
                      <td>{p.label}</td>
                      <td>{orders.data ? orders.data.filter((o) => o.promo === p.code).length : '…'}</td>
                      <td><Toggle checked={p.active} label={`Промокод ${p.code}`} onChange={(on) => toggle(p, on)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </section>
      <section className="panel promo-banner">
        <div><h2>Баннер «−20% на аудио»</h2><p className="muted">Показывается в фильтрах каталога. Клик копирует промокод SOUND20.</p></div>
        <Link to="/" className="btn btn-ghost"><Icon name="store" size={16} /> Посмотреть на витрине</Link>
      </section>
    </>
  );
}

export function Settings() {
  const { catalog, reloadCatalog, toast } = useShop();
  const [value, setValue] = useState(catalog.settings.freeDeliveryFrom);
  useEffect(() => setValue(catalog.settings.freeDeliveryFrom), [catalog.settings.freeDeliveryFrom]);

  const save = async () => {
    const v = Math.max(0, Math.round(Number(value) || 0));
    try {
      await api.updateSettings({ freeDeliveryFrom: v });
      await reloadCatalog();
      toast(`Бесплатная доставка от ${money(v)}`, 'truck');
    } catch (err) { toast(err.message, 'x'); }
  };

  const reset = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Сбросить корзину, заказы и изменения в админке?')) {
      api.reset();
      localStorage.removeItem('nova-store:cart:v2');
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  return (
    <>
      <PageHead title="Настройки" sub="Параметры магазина" />
      <section className="panel settings">
        <label className="field">
          <span>Бесплатная доставка курьером от, ₽</span>
          <input className="input mono" type="number" min="0" step="500" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          <small className="muted">Сейчас: {money(catalog.settings.freeDeliveryFrom)}. Значение сразу используется в корзине и на странице товара.</small>
        </label>
        {api.mode === 'demo' && (
          <div className="settings-row">
            <div><strong>Демо-данные</strong><p className="muted">Вернуть корзину, заказы, товары и настройки к исходному состоянию.</p></div>
            <button type="button" className="btn btn-danger" onClick={reset}><Icon name="refresh" size={16} /> Сбросить</button>
          </div>
        )}
      </section>
    </>
  );
}
