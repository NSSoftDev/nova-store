/**
 * Nova Store — icons & product illustrations as React components.
 *   <Icon name="cart" size={18} />
 *   <Stars rating={4.9} />
 *   <ProductArt kind="headphones" palette={['#c084fc', '#818cf8']} />
 * SVG bodies are static strings defined in this file (no user input), so
 * injecting them with dangerouslySetInnerHTML is safe.
 */
import { useId } from 'react';

/* Stroke icon set, 24×24, currentColor */
export const ICONS = {
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7H6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  truck: '<path d="M1.5 6.5h12v9.5h-12z"/><path d="M13.5 9.5h4.2l3.3 3.3V16h-7.5"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-4M12.5 17V9M17 17v-7"/>',
  trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
};

/* Product illustrations, 120×120. Each drawer gets (fill, palette, darkColor). */
export const DRAW = {
  headphones: (f) => `
    <path d="M24 72V60a36 36 0 0 1 72 0v12" fill="none" stroke="${f}" stroke-width="9" stroke-linecap="round"/>
    <rect x="16" y="62" width="22" height="36" rx="11" fill="${f}"/>
    <rect x="82" y="62" width="22" height="36" rx="11" fill="${f}"/>`,
  earbuds: (f, p, dark) => `
    <rect x="24" y="44" width="72" height="52" rx="24" fill="${f}"/>
    <path d="M24 66h72" stroke="${dark}" stroke-opacity=".35" stroke-width="2.5"/>
    <circle cx="60" cy="82" r="3" fill="#fff" fill-opacity=".9"/>
    <rect x="40" y="24" width="12" height="26" rx="6" fill="${f}" opacity=".85"/>
    <rect x="68" y="24" width="12" height="26" rx="6" fill="${f}" opacity=".85"/>`,
  watch: (f, p, dark) => `
    <rect x="46" y="12" width="28" height="26" rx="8" fill="${p[1]}" opacity=".55"/>
    <rect x="46" y="82" width="28" height="26" rx="8" fill="${p[1]}" opacity=".55"/>
    <circle cx="60" cy="60" r="31" fill="${dark}"/>
    <circle cx="60" cy="60" r="31" fill="none" stroke="${f}" stroke-width="7"/>
    <path d="M60 42v19l11 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  sneaker: (f) => `
    <path d="M12 80c0-12 8-16 16-18l22-11c6-3 10 2 14 6 8 8 26 10 36 14 6 2 6 10 2 12H16c-3 0-4-1-4-3z" fill="${f}"/>
    <rect x="12" y="83" width="98" height="8" rx="4" fill="#eef0ff"/>
    <path d="M52 56l5 6M60 54l5 6" stroke="#fff" stroke-opacity=".75" stroke-width="2.5" stroke-linecap="round"/>`,
  speaker: (f, p, dark) => `
    <rect x="34" y="16" width="52" height="88" rx="14" fill="${f}"/>
    <circle cx="60" cy="40" r="8" fill="${dark}"/>
    <circle cx="60" cy="74" r="17" fill="${dark}"/>
    <circle cx="60" cy="74" r="7" fill="${f}"/>`,
  camera: (f, p, dark) => `
    <rect x="30" y="28" width="26" height="16" rx="5" fill="${f}" opacity=".8"/>
    <rect x="12" y="38" width="96" height="62" rx="14" fill="${f}"/>
    <circle cx="60" cy="69" r="21" fill="${dark}"/>
    <circle cx="60" cy="69" r="12" fill="none" stroke="${f}" stroke-width="4"/>
    <circle cx="92" cy="50" r="3.5" fill="#fff" fill-opacity=".8"/>`,
  backpack: (f) => `
    <path d="M46 32a14 14 0 0 1 28 0" fill="none" stroke="${f}" stroke-width="7" stroke-linecap="round"/>
    <rect x="26" y="30" width="68" height="78" rx="20" fill="${f}"/>
    <rect x="38" y="68" width="44" height="26" rx="9" fill="#fff" fill-opacity=".22"/>`,
  lamp: (f) => `
    <path d="M42 24h36l16 32H26z" fill="${f}"/>
    <rect x="58" y="56" width="5" height="40" rx="2.5" fill="#d9dcf5"/>
    <rect x="38" y="94" width="44" height="7" rx="3.5" fill="#d9dcf5"/>`,
  bottle: (f) => `
    <rect x="49" y="12" width="22" height="13" rx="3.5" fill="#e8e9f3"/>
    <rect x="41" y="25" width="38" height="86" rx="13" fill="${f}"/>
    <rect x="41" y="56" width="38" height="15" fill="#fff" fill-opacity=".2"/>`,
  keyboard: (f, p, dark) => {
    let keys = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) keys += `<rect x="${21 + c * 10}" y="${48 + r * 10}" width="7" height="7" rx="1.8" fill="${dark}" opacity=".55"/>`;
    }
    return `<rect x="12" y="38" width="96" height="48" rx="10" fill="${f}"/>${keys}<rect x="34" y="78" width="52" height="5" rx="2.5" fill="${dark}" opacity=".55"/>`;
  },
  hoodie: (f, p, dark) => `
    <path d="M44 22c4 8 28 8 32 0l22 12 12 30-14 6-6-14v52H30V56l-6 14-14-6 12-30z" fill="${f}"/>
    <path d="M48 24c2 14 22 14 24 0" fill="none" stroke="${dark}" stroke-opacity=".35" stroke-width="3"/>
    <rect x="44" y="76" width="32" height="16" rx="5" fill="#fff" fill-opacity=".18"/>`,
  dumbbell: (f) => `
    <rect x="40" y="56" width="40" height="8" rx="4" fill="#d9dcf5"/>
    <rect x="16" y="36" width="12" height="48" rx="5" fill="${f}"/>
    <rect x="28" y="42" width="12" height="36" rx="5" fill="${f}" opacity=".85"/>
    <rect x="92" y="36" width="12" height="48" rx="5" fill="${f}"/>
    <rect x="80" y="42" width="12" height="36" rx="5" fill="${f}" opacity=".85"/>`,
  mug: (f) => `
    <path d="M84 48h6a14 14 0 0 1 0 28h-6" fill="none" stroke="${f}" stroke-width="8"/>
    <rect x="26" y="34" width="60" height="70" rx="14" fill="${f}"/>
    <path d="M46 14c-4 6 4 8 0 14M60 12c-4 6 4 8 0 14" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`,
  sunglasses: (f, p, dark) => `
    <path d="M10 50h100" stroke="#d9dcf5" stroke-width="5" stroke-linecap="round"/>
    <path d="M16 50h36v10a18 18 0 0 1-36 0z" fill="${f}"/>
    <path d="M68 50h36v10a18 18 0 0 1-36 0z" fill="${f}"/>
    <path d="M24 56l8-6M76 56l8-6" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`,
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={`ico ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.box }}
    />
  );
}

/** 5-star row; partial stars via a CSS gradient mask (--fill). */
export function Stars({ rating, size = 12 }) {
  return (
    <span className="stars" aria-label={`Рейтинг ${String(rating).replace('.', ',')} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return <span key={i} className="star" style={{ '--fill': `${Math.round(fill * 100)}%`, width: size, height: size }} />;
      })}
    </span>
  );
}

/** Vector product "photo" filled with a two-stop gradient. */
export function ProductArt({ kind, palette = ['#c084fc', '#818cf8'], transform, size }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const draw = DRAW[kind] || DRAW.headphones;
  const body = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>${draw(`url(#${id})`, palette, '#17141f')}`;
  return (
    <svg
      className="art"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={transform ? { transform } : undefined}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
