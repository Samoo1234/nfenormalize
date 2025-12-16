-- ============================================================
-- SCHEMA PARA NFE SYSTEM
-- ============================================================

-- Tabela de Produtos (já existe, mantém como está)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text,
  nome text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de Notas Fiscais
create table if not exists public.nfe (
  id uuid primary key default gen_random_uuid(),
  numero_nota text,
  data_nota date,
  tipo text check (tipo in ('entrada', 'saida')), -- NOVO: diferenciar compra/venda
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de Itens das Notas
create table if not exists public.nfe_item (
  id uuid primary key default gen_random_uuid(),
  nfe_id uuid references public.nfe(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantidade_kg numeric,
  valor_por_kg numeric,
  valor_total numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ADICIONAR COLUNA TIPO SE NÃO EXISTIR
-- ============================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'nfe' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE public.nfe ADD COLUMN tipo text check (tipo in ('entrada', 'saida'));
  END IF;
END $$;

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_nfe_data on public.nfe (data_nota);
create index if not exists idx_nfe_tipo on public.nfe (tipo);
create index if not exists idx_nfe_item_nfe_id on public.nfe_item (nfe_id);
create index if not exists idx_nfe_item_product_id on public.nfe_item (product_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.products enable row level security;
alter table public.nfe enable row level security;
alter table public.nfe_item enable row level security;

-- ============================================================
-- POLÍTICAS - PRODUCTS
-- ============================================================
drop policy if exists read_products on public.products;
create policy read_products on public.products
  for select using (true);

drop policy if exists insert_products_public on public.products;
create policy insert_products_public on public.products
  for insert with check (true);

drop policy if exists update_products_public on public.products;
create policy update_products_public on public.products
  for update using (true) with check (true);

-- ============================================================
-- POLÍTICAS - NFE
-- ============================================================
drop policy if exists read_nfe on public.nfe;
create policy read_nfe on public.nfe
  for select using (true);

drop policy if exists insert_nfe_public on public.nfe;
create policy insert_nfe_public on public.nfe
  for insert with check (true);

drop policy if exists update_nfe_public on public.nfe;
create policy update_nfe_public on public.nfe
  for update using (true) with check (true);

-- ============================================================
-- POLÍTICAS - NFE_ITEM
-- ============================================================
drop policy if exists read_nfe_item on public.nfe_item;
create policy read_nfe_item on public.nfe_item
  for select using (true);

drop policy if exists insert_nfe_item_public on public.nfe_item;
create policy insert_nfe_item_public on public.nfe_item
  for insert with check (true);

drop policy if exists update_nfe_item_public on public.nfe_item;
create policy update_nfe_item_public on public.nfe_item
  for update using (true) with check (true);
