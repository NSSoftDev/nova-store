/**
 * Revenue by day: current period (area) vs previous (dashed), hover tooltip.
 * Pure SVG with a non-scaling stroke, so it stays crisp at any width.
 */
import { useRef, useState } from 'react';
import { money } from '../../lib/format.js';

const W = 760;
const H = 230;
const PAD_T = 14;
const PAD_B = 26;

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function RevenueChart({ series, prevSeries, dates }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);

  const all = series.concat(prevSeries);
  const max = Math.max(...all) * 1.08;
  const min = Math.min(...all) * 0.82;
  const x = (i, n) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);
  const cur = series.map((v, i) => [x(i, series.length), y(v)]);
  const prev = prevSeries.map((v, i) => [x(i, prevSeries.length), y(v)]);
  const line = smoothPath(cur);
  const last = cur[cur.length - 1];
  const lastIdx = dates.length - 1;
  const every = Math.ceil(dates.length / 6);
  const short = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * lastIdx));
  };

  let tip = null;
  if (hover !== null) {
    const label = new Date(dates[hover]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    tip = { left: (hover / lastIdx) * 100, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }

  return (
    <div className="chart" ref={ref} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity=".45" />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => {
          const gy = PAD_T + f * (H - PAD_T - PAD_B);
          return <line key={f} x1="0" x2={W} y1={gy} y2={gy} className="grid-line" />;
        })}
        <path d={smoothPath(prev)} className="line-prev" vectorEffect="non-scaling-stroke" />
        <path d={`${line} L${W},${H - PAD_B} L0,${H - PAD_B} Z`} fill="url(#rev-fill)" />
        <path d={line} className="line-cur" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="chart-dot" style={{ left: `${(last[0] / W) * 100}%`, top: `${(last[1] / H) * 100}%` }} />
      {tip && (
        <>
          <span className="chart-cursor" style={{ left: `${tip.left}%` }} />
          <div className="chart-tip" style={{ left: `${Math.min(82, Math.max(4, tip.left))}%` }}>
            <strong>{tip.label}</strong>
            <span><i className="lg lg-cur" />{money(series[hover])}</span>
            <span><i className="lg lg-prev" />{money(prevSeries[hover] || 0)}</span>
          </div>
        </>
      )}
      <div className="chart-x">
        {dates.map((d, i) => ((i % every === 0 && lastIdx - i >= every * 0.6) || i === lastIdx
          ? <span key={d} style={{ left: `${(x(i, dates.length) / W) * 100}%` }}>{short(d)}</span>
          : null))}
      </div>
    </div>
  );
}
