/**
 * Заказы: status filter, search, inline status change.
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ORDER_STATUSES } from '@nova/shared';
import { Icon } from '../../lib/icons.jsx';
import { formatDate, initials, money, plural } from '../../lib/format.js';
import { useApi } from '../../lib/useApi.js';
import { useShop } from '../../state/ShopContext.jsx';
import { api } from '../../api/index.js';
import { Async, PageHead, StatusPill } from './common.jsx';

export function OrdersTable({ orders, onStatus }) {
  if (!orders.length) return <div className="empty empty-sm"><p>Заказов не найдено.</p></div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Заказ</th><th>Клиент</th><th>Дата</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={o.source === 'web' ? 'is-new' : undefined}>
              <td className="mono">#{o.id}</td>
              <td><span className="person"><span className="avatar avatar-sm">{initials(o.customer)}</span>{o.customer}</span></td>
              <td className="muted">{formatDate(o.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td><strong>{money(o.total)}</strong></td>
              <td className="muted">{o.payment}</td>
              <td>
                {onStatus ? (
                  <select className={`input input-sm status-select tone-${ORDER_STATUSES[o.status].tone}`} value={o.status} onChange={(e) => onStatus(o, e.target.value)} aria-label={`Статус заказа ${o.id}`}>
                    {Object.entries(ORDER_STATUSES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                  </select>
                ) : <StatusPill status={o.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Orders() {
  const { onUnauthorized } = useOutletContext();
  const { toast } = useShop();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const orders = useApi(() => api.orders(), []);

  const changeStatus = async (order, status) => {
    try {
      const updated = await api.updateOrder(order.id, status);
      orders.setData((list) => list.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o)));
      toast(`Заказ #${order.id}: ${ORDER_STATUSES[status].label}`, 'box');
    } catch (err) { toast(err.message, 'x'); }
  };

  return (
    <Async state={orders} onUnauthorized={onUnauthorized}>
      {(all) => {
        const q = query.trim().toLowerCase();
        const list = all
          .filter((o) => filter === 'all' || o.status === filter)
          .filter((o) => !q || `${o.id} ${o.customer}`.toLowerCase().includes(q));
        return (
          <>
            <PageHead title="Заказы" sub={`${all.length} ${plural(all.length, 'заказ', 'заказа', 'заказов')} · новые из витрины отмечены`} />
            <div className="toolbar">
              <div className="chips">
                <button type="button" className={`chip${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>Все · {all.length}</button>
                {Object.entries(ORDER_STATUSES).map(([k, s]) => (
                  <button key={k} type="button" className={`chip${filter === k ? ' is-active' : ''}`} onClick={() => setFilter(k)}>{s.label} · {all.filter((o) => o.status === k).length}</button>
                ))}
              </div>
              <label className="search search-sm"><Icon name="search" size={16} /><input type="search" placeholder="Номер или клиент" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск заказов" /></label>
            </div>
            <section className="panel"><OrdersTable orders={list} onStatus={changeStatus} /></section>
          </>
        );
      }}
    </Async>
  );
}
