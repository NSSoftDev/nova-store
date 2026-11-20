-- Nova Store — initial schema (PostgreSQL 14+)
-- Money is stored as integer roubles; the shop has no kopecks.

CREATE TABLE categories (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  position  integer NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id           text PRIMARY KEY,
  name         text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  brand        text NOT NULL,
  category_id  text NOT NULL REFERENCES categories (id),
  kind         text NOT NULL,                       -- illustration key used by the client
  price        integer NOT NULL CHECK (price > 0),
  old_price    integer CHECK (old_price IS NULL OR old_price > price),
  rating       numeric(2, 1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  reviews      integer NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  badge        text CHECK (badge IN ('hit', 'new')),
  audio        boolean NOT NULL DEFAULT false,      -- eligible for audio-only promo codes
  stock        integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sold         integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  added        integer NOT NULL DEFAULT 0,          -- higher = newer (catalogue "new" sort)
  colors       text[] NOT NULL CHECK (cardinality(colors) > 0),
  description  text NOT NULL DEFAULT '',
  specs        jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_visible_sold_idx ON products (sold DESC) WHERE NOT hidden;

CREATE TABLE promo_codes (
  code          text PRIMARY KEY CHECK (code = upper(code)),
  label         text NOT NULL,
  percent       integer NOT NULL CHECK (percent BETWEEN 1 AND 90),
  scope         text NOT NULL CHECK (scope IN ('all', 'audio')),
  min_subtotal  integer CHECK (min_subtotal IS NULL OR min_subtotal > 0),
  active        boolean NOT NULL DEFAULT true
);

CREATE SEQUENCE order_number_seq START 48214;

CREATE TABLE orders (
  id                text PRIMARY KEY,                -- "NS-48214"
  customer_name     text NOT NULL,
  customer_phone    text,
  delivery_method   text NOT NULL CHECK (delivery_method IN ('courier', 'express', 'pickup')),
  delivery_address  text,
  delivery_slot     text,
  payment_method    text NOT NULL CHECK (payment_method IN ('Карта', 'СБП', 'Сплит')),
  promo_code        text REFERENCES promo_codes (code),
  subtotal          integer NOT NULL DEFAULT 0,
  discount          integer NOT NULL DEFAULT 0,
  delivery_price    integer NOT NULL DEFAULT 0,
  total             integer NOT NULL CHECK (total >= 0),
  status            text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'shipping', 'delivered', 'returned')),
  source            text NOT NULL DEFAULT 'web' CHECK (source IN ('seed', 'web')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_created_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);

CREATE TABLE order_items (
  order_id    text NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id  text NOT NULL REFERENCES products (id),
  name        text NOT NULL,                         -- snapshot at purchase time
  color       text NOT NULL,
  qty         integer NOT NULL CHECK (qty BETWEEN 1 AND 99),
  unit_price  integer NOT NULL CHECK (unit_price > 0),
  PRIMARY KEY (order_id, product_id, color)
);

-- Pre-aggregated daily sales for the admin chart (filled by an ETL job in
-- production; seeded with demo history here).
CREATE TABLE daily_revenue (
  day           date PRIMARY KEY,
  revenue       integer NOT NULL,
  orders        integer NOT NULL,
  returns_rate  numeric(4, 2) NOT NULL
);

CREATE TABLE settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
);
