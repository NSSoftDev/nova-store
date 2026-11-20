/**
 * Обзор: KPIs vs previous period, revenue chart, top products, latest orders.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { RANGES } from '@nova/shared';
import { Icon, ProductArt } from '../../lib/icons.jsx';
import { compactMoney, fmt, fmtDec, money, paletteOf } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../api/index.js';
import RevenueChart from './RevenueChart.jsx';
import { Async, Delta, PageHead } from './common.jsx';
import { OrdersTable } from './Orders.jsx';
import { NewProductButton } from './Products.jsx';

export default function Overview() {
  const { onUnauthorized } = useOutletContext();
  const [range, setRange] = useState('12d');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const stats = useApi(() => api.stats(range), [range]);
  const products = useApi(() => api.adminProducts(), []);
  const orders = useApi(() => api.orders(), []);

  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <>
      <PageHead title="Обзор продаж" sub="Ноябрь 2026 · все каналы">
        <div className="range-picker" ref={pickerRef}>
          <button type="button" className="btn btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name="calendar" size={16} /> {RANGES[range].label}
          </button>
          {open && (
            <div className="menu" role="menu">
              {Object.entries(RANGES).map(([k, r]) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={k === range} onClick={() => { setRange(k); setOpen(false); }}>
                  {k === range ? <Icon name="check" size={15} /> : <span className="ico-space" />} {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <NewProductButton onCreated={() => { products.reload(); }} />
      </PageHead>

      <Async state={stats} onUnauthorized={onUnauthorized}>
        {(s) => (
          <>
            <div className="kpis">
              <article className="kpi"><div className="kpi-top"><span>Выручка</span><span className="kpi-ico"><Icon name="card" size={17} /></span></div><strong>{compactMoney(s.revenue)}</strong><Delta value={s.delta.revenue} /><span className="muted"> к прошлому периоду</span></article>
              <article className="kpi"><div className="kpi-top"><span>Заказы</span><span className="kpi-ico"><Icon name="box" size={17} /></span></div><strong>{fmt(s.orders)}</strong><Delta value={s.delta.orders} /><span className="muted"> к прошлому периоду</span></article>
              <article className="kpi"><div className="kpi-top"><span>Средний чек</span><span className="kpi-ico"><Icon name="tag" size={17} /></span></div><strong>{money(s.avgCheck)}</strong><Delta value={s.delta.avgCheck} /><span className="muted"> к прошлому периоду</span></article>
              <article className="kpi"><div className="kpi-top"><span>Возвраты</span><span className="kpi-ico"><Icon name="truck" size={17} /></span></div><strong>{fmtDec(s.returnsRate, 1)}%</strong><Delta value={s.delta.returnsRate} invert /><span className="muted"> к прошлому периоду</span></article>
            </div>

            <div className="admin-grid">
              <section className="panel">
                <div className="panel-head">
                  <h2>Выручка по дням</h2>
                  <div className="legend"><span><i className="lg lg-cur" />Текущий период</span><span><i className="lg lg-prev" />Предыдущий</span></div>
                </div>
                <RevenueChart series={s.series} prevSeries={s.prevSeries} dates={s.dates} />
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Топ товаров</h2><Link to="/admin/products" className="link-btn">Все</Link></div>
                <Async state={products} onUnauthorized={onUnauthorized}>
                  {(list) => {
                    const top = [...list].sort((a, b) => b.sold - a.sold).slice(0, 5);
                    return (
                      <ul className="top-list">
                        {top.map((p) => (
                          <li key={p.id}>
                            <Link to={`/p/${p.id}`} className="top-art" title="Открыть в магазине"><ProductArt kind={p.kind} palette={paletteOf(p)} /></Link>
                            <div className="top-body">
                              <div className="top-row"><span>{p.name}</span><strong>{fmt(p.sold)}</strong></div>
                              <div className="bar"><span style={{ width: `${(p.sold / top[0].sold) * 100}%` }} /></div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    );
                  }}
                </Async>
              </section>
            </div>
          </>
        )}
      </Async>

      <section className="panel">
        <div className="panel-head"><h2>Последние заказы</h2><Link to="/admin/orders" className="link-btn">Все заказы</Link></div>
        <Async state={orders} onUnauthorized={onUnauthorized}>
          {(list) => <OrdersTable orders={list.slice(0, 5)} />}
        </Async>
      </section>
    </>
  );
}
