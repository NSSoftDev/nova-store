/**
 * Shared admin building blocks.
 */
import { ORDER_STATUSES } from '@nova/shared';
import { Icon } from '../../lib/icons.jsx';
import { fmtDec } from '../../lib/format.js';

export function PageHead({ title, sub, children }) {
  return (
    <header className="page-head">
      <div><h1>{title}</h1><p className="muted">{sub}</p></div>
      <div className="page-actions">{children}</div>
    </header>
  );
}

export function StatusPill({ status }) {
  const s = ORDER_STATUSES[status] || ORDER_STATUSES.processing;
  return <span className={`pill pill-${s.tone}`}>{s.label}</span>;
}

export function Delta({ value, invert = false }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  return <span className={`delta ${good ? 'is-good' : 'is-bad'}`}>{up ? '▲' : '▼'} {fmtDec(Math.abs(value), 1)}%</span>;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

/** Loading / error wrapper for admin panels. */
export function Async({ state, children, onUnauthorized }) {
  if (state.error) {
    if (state.error.status === 401 && onUnauthorized) { onUnauthorized(); return null; }
    return (
      <div className="empty empty-sm">
        <p>{state.error.message}</p>
        <button type="button" className="btn btn-ghost" onClick={state.reload}><Icon name="refresh" size={16} /> Повторить</button>
      </div>
    );
  }
  if (!state.data) return <div className="panel skeleton skeleton-panel" aria-busy="true" />;
  return children(state.data);
}
