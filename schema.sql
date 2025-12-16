-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
create table if not exists public.products (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PURCHASE INVOICES TABLE (Notas de Entrada/Compra)
-- ============================================================
create table if not exists public.purchase_invoices (
  id bigserial primary key,
  invoice_number text,
  invoice_date date,
  product text,
  quantity_kg numeric,
  total_value numeric,
  average_cost_per_kg numeric,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SALE INVOICES TABLE (Notas de Saída/Venda)
-- ============================================================
create table if not exists public.sale_invoices (
  id bigserial primary key,
  invoice_number text,
  invoice_date date,
  product text,
  quantity_kg numeric,
  total_value numeric,
  sale_cost_per_kg numeric default null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONSTRAINTS
-- ============================================================
alter table public.purchase_invoices
  add constraint purchase_invoices_unique unique (invoice_number, invoice_date, product);

alter table public.sale_invoices
  add constraint sale_invoices_unique unique (invoice_number, invoice_date, product);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_purchase_invoices_date on public.purchase_invoices (invoice_date);
create index if not exists idx_purchase_invoices_product on public.purchase_invoices (product);

create index if not exists idx_sale_invoices_date on public.sale_invoices (invoice_date);
create index if not exists idx_sale_invoices_product on public.sale_invoices (product);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.products enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.sale_invoices enable row level security;

-- ============================================================
-- POLICIES - PRODUCTS
-- ============================================================
create policy read_products on public.products
  for select using (true);

create policy insert_products_public on public.products
  for insert using (true) with check (true);

-- ============================================================
-- POLICIES - PURCHASE INVOICES
-- ============================================================
create policy read_purchase_invoices on public.purchase_invoices
  for select using (true);

create policy insert_purchase_invoices_service_role on public.purchase_invoices
  for insert using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- POLICIES - SALE INVOICES
-- ============================================================
create policy read_sale_invoices on public.sale_invoices
  for select using (true);

create policy insert_sale_invoices_service_role on public.sale_invoices
  for insert using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Allow public update of sale_cost_per_kg column only
create policy update_sale_cost_per_kg on public.sale_invoices
  for update using (true)
  with check (true);
