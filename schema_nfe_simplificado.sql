-- ====================================================================
-- Schema NFe Simplificado - Tabela Única
-- ====================================================================
-- Caso de uso: 1 linha Excel = 1 NFe = 1 produto
-- Produto e quantidade são inseridos manualmente depois
-- ====================================================================

-- Tabela única de NFe (simplificada)
create table if not exists public.nfe (
  id uuid primary key default gen_random_uuid(),
  
  -- Dados da nota
  numero_nota text,
  data_nota date,
  tipo text check (tipo in ('entrada', 'saida')),
  
  -- Dados do item (antes em nfe_item)
  product_id uuid references public.products(id) on delete set null,
  quantidade_kg numeric,
  valor_por_kg numeric,
  valor_total numeric,
  
  -- Metadados
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_nfe_data_nota on public.nfe(data_nota desc);
create index if not exists idx_nfe_tipo on public.nfe(tipo);
create index if not exists idx_nfe_product_id on public.nfe(product_id);
create index if not exists idx_nfe_numero_nota on public.nfe(numero_nota);

-- Trigger para atualizar updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger nfe_updated_at
  before update on public.nfe
  for each row
  execute function update_updated_at_column();

-- Comentários para documentação
comment on table public.nfe is 'Notas Fiscais Eletrônicas - Tabela única simplificada (1 nota = 1 produto)';
comment on column public.nfe.tipo is 'Tipo da nota: entrada ou saida';
comment on column public.nfe.product_id is 'Produto associado (preenchido manualmente depois do import)';
comment on column public.nfe.quantidade_kg is 'Quantidade em KG (preenchido manualmente)';
comment on column public.nfe.valor_por_kg is 'Valor unitário por KG';
comment on column public.nfe.valor_total is 'Valor total da nota';
