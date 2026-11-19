/* ==========================================================================
   Nova Store — data.js
   --------------------------------------------------------------------------
   Static demo catalogue and analytics seed. In a real deployment this is
   what the Node.js / PostgreSQL API would return (GET /api/products,
   GET /api/admin/stats …); here it is bundled so the app runs anywhere,
   including GitHub Pages, without a backend.
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});

  /* Colour variants shared by products (used by swatches + illustrations) */
  const COLORS = {
    lavender: { name: 'Лавандовый', palette: ['#c084fc', '#818cf8'] },
    pink: { name: 'Розовый', palette: ['#f9a8d4', '#e879f9'] },
    cyan: { name: 'Бирюзовый', palette: ['#67e8f9', '#38bdf8'] },
    white: { name: 'Белый', palette: ['#f8fafc', '#cbd5e1'] },
    graphite: { name: 'Графит', palette: ['#52525b', '#27272a'] },
    blue: { name: 'Небесный', palette: ['#93c5fd', '#818cf8'] },
    mint: { name: 'Мятный', palette: ['#6ee7b7', '#22d3ee'] },
    sunset: { name: 'Закат', palette: ['#fdba74', '#f472b6'] },
  };

  const CATEGORIES = [
    { id: 'electronics', name: 'Электроника' },
    { id: 'accessories', name: 'Аксессуары' },
    { id: 'sport', name: 'Спорт' },
    { id: 'home', name: 'Дом' },
    { id: 'clothes', name: 'Одежда' },
  ];

  /*
   * Product fields:
   *   audio   — eligible for the SOUND20 promo code (−20 % on audio)
   *   sold    — units sold this month (drives "popular" sort + admin top)
   *   added   — higher = newer (drives "new" sort)
   */
  const PRODUCTS = [
    {
      id: 'aura-pro-anc', name: 'Наушники Aura Pro', brand: 'Aura', cat: 'electronics', kind: 'headphones',
      price: 14990, oldPrice: 17990, rating: 4.9, reviews: 312, badge: 'hit', audio: true, stock: 48, sold: 644, added: 9,
      colors: ['lavender', 'pink', 'cyan', 'white', 'graphite'],
      desc: 'Беспроводные наушники с активным шумоподавлением, пространственным звуком и автономностью до 40 часов. Быстрая зарядка USB-C: 10 минут — 5 часов музыки.',
      specs: { 'Тип': 'Полноразмерные, закрытые', 'Шумоподавление': 'Активное, до −38 дБ', 'Автономность': 'до 40 ч', 'Bluetooth': '5.4, multipoint', 'Кодеки': 'AAC, LDAC', 'Вес': '254 г' },
    },
    {
      id: 'pulse-s2', name: 'Часы Pulse S2', brand: 'Pulse', cat: 'electronics', kind: 'watch',
      price: 22490, rating: 4.8, reviews: 198, stock: 31, sold: 546, added: 8,
      colors: ['lavender', 'graphite', 'mint'],
      desc: 'Умные часы с AMOLED-экраном, датчиком пульса и SpO₂, GPS и 120 спортивными режимами. Защита 5 ATM — можно плавать.',
      specs: { 'Экран': 'AMOLED 1,43″', 'Датчики': 'Пульс, SpO₂, GPS', 'Автономность': 'до 14 дней', 'Защита': '5 ATM', 'Совместимость': 'iOS, Android', 'Вес': '36 г' },
    },
    {
      id: 'flux-run', name: 'Кроссовки Flux Run', brand: 'Flux', cat: 'sport', kind: 'sneaker',
      price: 9790, oldPrice: 11490, rating: 4.7, reviews: 541, stock: 120, sold: 448, added: 6,
      colors: ['blue', 'pink', 'white'],
      desc: 'Лёгкие беговые кроссовки с пеной повышенной упругости и дышащим сетчатым верхом. Для темповых и длинных пробежек.',
      specs: { 'Назначение': 'Бег по асфальту', 'Дроп': '8 мм', 'Вес': '238 г (42 р.)', 'Верх': 'Инженерная сетка', 'Подошва': 'Пена Flux Foam' },
    },
    {
      id: 'beam-mini', name: 'Колонка Beam Mini', brand: 'Beam', cat: 'electronics', kind: 'speaker',
      price: 6290, rating: 4.6, reviews: 127, audio: true, stock: 64, sold: 357, added: 5,
      colors: ['blue', 'pink', 'graphite'],
      desc: 'Компактная колонка с насыщенным басом и защитой IP67. Две колонки объединяются в стереопару одним нажатием.',
      specs: { 'Мощность': '10 Вт', 'Защита': 'IP67', 'Автономность': 'до 16 ч', 'Bluetooth': '5.3', 'Вес': '320 г' },
    },
    {
      id: 'lumen-x', name: 'Камера Lumen X', brand: 'Lumen', cat: 'electronics', kind: 'camera',
      price: 48900, rating: 4.9, reviews: 86, badge: 'hit', stock: 12, sold: 120, added: 7,
      colors: ['lavender', 'graphite'],
      desc: 'Беззеркальная камера с полнокадровой матрицей 24 Мп, 5-осевой стабилизацией и видео 4K 60p.',
      specs: { 'Матрица': 'Full Frame, 24 Мп', 'Стабилизация': '5 осей', 'Видео': '4K 60p, 10 бит', 'Экран': 'Поворотный 3″', 'Вес': '658 г' },
    },
    {
      id: 'urban-24l', name: 'Рюкзак Urban 24L', brand: 'Urban', cat: 'accessories', kind: 'backpack',
      price: 5490, rating: 4.8, reviews: 402, stock: 86, sold: 300, added: 4,
      colors: ['blue', 'graphite', 'sunset'],
      desc: 'Городской рюкзак с отделением для ноутбука 16″, водоотталкивающей тканью и скрытым карманом для документов.',
      specs: { 'Объём': '24 л', 'Ноутбук': 'до 16″', 'Материал': 'Нейлон 600D, водоотталкивающий', 'Вес': '780 г' },
    },
    {
      id: 'halo-desk', name: 'Лампа Halo Desk', brand: 'Halo', cat: 'home', kind: 'lamp',
      price: 3990, rating: 4.5, reviews: 73, stock: 40, sold: 140, added: 3,
      colors: ['lavender', 'white'],
      desc: 'Настольная LED-лампа с регулировкой яркости и цветовой температуры. Без мерцания — комфортно для глаз.',
      specs: { 'Мощность': '9 Вт', 'Температура': '2700–6500 K', 'Яркость': '10 уровней', 'Питание': 'USB-C' },
    },
    {
      id: 'hydro', name: 'Термобутылка Hydro', brand: 'Hydro', cat: 'sport', kind: 'bottle',
      price: 1990, rating: 4.7, reviews: 265, stock: 210, sold: 280, added: 2,
      colors: ['cyan', 'pink', 'white'],
      desc: 'Термобутылка из нержавеющей стали: держит холод 24 часа и тепло 12 часов. Не протекает в рюкзаке.',
      specs: { 'Объём': '750 мл', 'Холод': '24 ч', 'Тепло': '12 ч', 'Материал': 'Сталь 18/8' },
    },
    {
      id: 'aura-buds', name: 'Наушники Aura Buds', brand: 'Aura', cat: 'electronics', kind: 'earbuds',
      price: 8990, rating: 4.7, reviews: 233, badge: 'new', audio: true, stock: 75, sold: 210, added: 12,
      colors: ['white', 'lavender', 'graphite'],
      desc: 'Полностью беспроводные наушники с шумоподавлением и прозрачным режимом. До 30 часов с кейсом.',
      specs: { 'Тип': 'TWS, внутриканальные', 'Шумоподавление': 'Активное', 'Автономность': '8 ч + 22 ч с кейсом', 'Защита': 'IPX4' },
    },
    {
      id: 'keys-k1', name: 'Клавиатура Keys K1', brand: 'Keys', cat: 'electronics', kind: 'keyboard',
      price: 7490, rating: 4.6, reviews: 158, stock: 52, sold: 160, added: 1,
      colors: ['lavender', 'white', 'graphite'],
      desc: 'Механическая клавиатура 75 % с горячей заменой переключателей, подсветкой и тремя режимами подключения.',
      specs: { 'Формат': '75 %, 84 клавиши', 'Переключатели': 'Hot-swap', 'Подключение': 'USB-C, Bluetooth, 2,4 ГГц', 'Аккумулятор': '4000 мА·ч' },
    },
    {
      id: 'orbit-hoodie', name: 'Худи Orbit', brand: 'Orbit', cat: 'clothes', kind: 'hoodie',
      price: 4990, oldPrice: 5990, rating: 4.8, reviews: 312, stock: 140, sold: 230, added: 10,
      colors: ['lavender', 'graphite', 'mint'],
      desc: 'Свободное худи из плотного хлопка с начёсом. Двойной капюшон и карман-кенгуру.',
      specs: { 'Состав': '80 % хлопок, 20 % полиэстер', 'Плотность': '360 г/м²', 'Крой': 'Oversize', 'Размеры': 'XS–XXL' },
    },
    {
      id: 'core-dumbbells', name: 'Гантели Core 2×5 кг', brand: 'Core', cat: 'sport', kind: 'dumbbell',
      price: 3490, rating: 4.6, reviews: 98, stock: 34, sold: 90, added: 0,
      colors: ['lavender', 'graphite'],
      desc: 'Пара гантелей с неопреновым покрытием — не скользят в руке и не царапают пол.',
      specs: { 'Вес': '2 × 5 кг', 'Покрытие': 'Неопрен', 'Форма': 'Шестигранная' },
    },
    {
      id: 'brew-mug', name: 'Кружка Brew Thermo', brand: 'Brew', cat: 'home', kind: 'mug',
      price: 1290, rating: 4.9, reviews: 410, badge: 'new', stock: 300, sold: 180, added: 11,
      colors: ['sunset', 'white', 'cyan'],
      desc: 'Кружка с двойными стенками: кофе остаётся горячим, а руки — нет. Подходит для посудомоечной машины.',
      specs: { 'Объём': '350 мл', 'Стенки': 'Двойные, вакуум', 'Материал': 'Сталь + керамическое покрытие' },
    },
    {
      id: 'shade-polar', name: 'Очки Shade Polar', brand: 'Shade', cat: 'accessories', kind: 'sunglasses',
      price: 3290, rating: 4.5, reviews: 64, stock: 58, sold: 70, added: 0,
      colors: ['graphite', 'sunset', 'blue'],
      desc: 'Солнцезащитные очки с поляризацией и защитой UV400 в лёгкой оправе.',
      specs: { 'Линзы': 'Поляризованные, UV400', 'Оправа': 'TR90', 'Вес': '24 г' },
    },
    {
      id: 'beam-max', name: 'Колонка Beam Max', brand: 'Beam', cat: 'electronics', kind: 'speaker',
      price: 12990, rating: 4.8, reviews: 91, badge: 'new', audio: true, stock: 22, sold: 110, added: 13,
      colors: ['graphite', 'lavender', 'cyan'],
      desc: 'Мощная колонка для вечеринок: 40 Вт, подсветка в такт музыке и 20 часов работы.',
      specs: { 'Мощность': '40 Вт', 'Защита': 'IP67', 'Автономность': 'до 20 ч', 'Bluetooth': '5.3' },
    },
  ];

  /* Promo codes: `scope` decides which lines the discount applies to */
  const PROMOS = {
    SOUND20: { label: '−20 % на аудио', percent: 20, scope: 'audio', active: true },
    NOVA10: { label: '−10 % на всё от 5 000 ₽', percent: 10, scope: 'all', min: 5000, active: true },
  };

  /* Seed orders shown in the admin before the visitor places their own */
  const SEED_ORDERS = [
    { id: 'NS-48213', customer: 'Мария Лебедева', total: 12480, payment: 'Карта', status: 'delivered', date: '2026-11-12T11:20:00' },
    { id: 'NS-48212', customer: 'Игорь Ким', total: 3990, payment: 'СБП', status: 'shipping', date: '2026-11-12T10:05:00' },
    { id: 'NS-48211', customer: 'Анна Орлова', total: 48900, payment: 'Сплит', status: 'processing', date: '2026-11-12T09:41:00' },
    { id: 'NS-48210', customer: 'Тимур Алиев', total: 22490, payment: 'Карта', status: 'delivered', date: '2026-11-11T19:12:00' },
    { id: 'NS-48209', customer: 'Елена Пак', total: 7480, payment: 'СБП', status: 'delivered', date: '2026-11-11T16:30:00' },
    { id: 'NS-48208', customer: 'Олег Юрьев', total: 5490, payment: 'Карта', status: 'returned', date: '2026-11-10T13:02:00' },
    { id: 'NS-48207', customer: 'Дмитрий Соколов', total: 16280, payment: 'Сплит', status: 'shipping', date: '2026-11-10T09:47:00' },
  ];

  const ORDER_STATUSES = {
    processing: { label: 'Обработка', tone: 'warning' },
    shipping: { label: 'В пути', tone: 'accent' },
    delivered: { label: 'Доставлен', tone: 'success' },
    returned: { label: 'Возврат', tone: 'danger' },
  };

  /* ------------------------------------------------------------------
     Daily revenue history for the admin chart.
     Deterministic (seeded PRNG) so every visitor sees the same numbers.
     Series covers 14 Sep – 12 Nov 2026 (60 days); the last day is "today".
     ------------------------------------------------------------------ */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildHistory() {
    const rand = mulberry32(48213);
    const days = 60;
    const end = new Date('2026-11-12T12:00:00');
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const t = (days - 1 - i) / (days - 1);            // 0 → 1 over the window
      const weekly = Math.sin((d.getDay() / 7) * Math.PI * 2) * 0.08; // weekend wave
      const trend = 0.78 + t * 0.42;                      // steady growth
      const noise = (rand() - 0.5) * 0.22;
      const revenue = Math.round(360000 * (trend + weekly + noise));
      const avgCheck = Math.round(1150 + rand() * 170 + t * 60);
      out.push({
        date: d.toISOString().slice(0, 10),
        revenue,
        orders: Math.round(revenue / avgCheck),
        returnsRate: 1.6 + rand() * 0.6 - t * 0.3,
      });
    }
    return out;
  }

  Nova.data = {
    COLORS,
    CATEGORIES,
    PRODUCTS,
    PROMOS,
    SEED_ORDERS,
    ORDER_STATUSES,
    HISTORY: buildHistory(),
    DEMO_TODAY: '2026-11-12',
    DELIVERY: {
      courier: { label: 'Курьер', eta: 'завтра, 10:00–14:00', price: 390 },
      express: { label: 'Экспресс', eta: 'сегодня, за 2 часа', price: 590 },
      pickup: { label: 'Пункт выдачи', eta: 'послезавтра, с 10:00', price: 0 },
    },
  };
})();
