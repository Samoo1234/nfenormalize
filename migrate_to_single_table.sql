-- ====================================================================
-- Migração: nfe + nfe_item → nfe (tabela única)
-- ====================================================================
-- ATENÇÃO: Execute primeiro em ambiente de dev/staging!
-- Faça backup manual antes de executar em produção!
-- ====================================================================

-- ====================================================================
-- PASSO 1: Criar tabela temporária com dados combinados
-- ====================================================================
CREATE TEMP TABLE nfe_new AS
SELECT 
  n.id,
  n.numero_nota,
  n.data_nota,
  n.tipo,
  i.product_id,
  i.quantidade_kg,
  i.valor_por_kg,
  i.valor_total,
  n.created_by,
  n.created_at,
  n.updated_at
FROM nfe n
LEFT JOIN nfe_item i ON n.id = i.nfe_id;

-- Verificar dados da tabela temporária
SELECT 
  COUNT(*) as total_registros,
  COUNT(product_id) as com_produto,
  COUNT(quantidade_kg) as com_quantidade
FROM nfe_new;

-- ====================================================================
-- PASSO 2: Backup das tabelas antigas
-- ====================================================================
ALTER TABLE nfe RENAME TO nfe_backup;
ALTER TABLE nfe_item RENAME TO nfe_item_backup;

-- ====================================================================
-- PASSO 3: Criar nova estrutura
-- ====================================================================
-- Execute o arquivo schema_nfe_simplificado.sql aqui
-- Ou copie e cole o conteúdo abaixo:

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

create index if not exists idx_nfe_data_nota on public.nfe(data_nota desc);
create index if not exists idx_nfe_tipo on public.nfe(tipo);
create index if not exists idx_nfe_product_id on public.nfe(product_id);
create index if not exists idx_nfe_numero_nota on public.nfe(numero_nota);

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

-- ====================================================================
-- PASSO 4: Copiar dados migrados
-- ====================================================================
INSERT INTO nfe 
SELECT * FROM nfe_new;

-- ====================================================================
-- PASSO 5: Verificar dados migrados
-- ====================================================================
SELECT 
  COUNT(*) as total_nfe,
  COUNT(product_id) as com_produto,
  COUNT(quantidade_kg) as com_quantidade,
  COUNT(valor_total) as com_valor_total
FROM nfe;

-- Comparar contagens
SELECT 'Registros na tabela backup' as descricao, COUNT(*) as total FROM nfe_backup
UNION ALL
SELECT 'Registros na tabela nova' as descricao, COUNT(*) as total FROM nfe;

-- Ver alguns registros de exemplo
SELECT 
  id,
  numero_nota,
  data_nota,
  tipo,
  product_id,
  quantidade_kg,
  valor_total
FROM nfe
ORDER BY data_nota DESC
LIMIT 10;

-- ====================================================================
-- PASSO 6: Deletar backups (SOMENTE APÓS CONFIRMAR QUE ESTÁ OK!)
-- ====================================================================
-- DESCOMENTE AS LINHAS ABAIXO APENAS APÓS VERIFICAR QUE TUDO ESTÁ FUNCIONANDO:

-- DROP TABLE nfe_backup CASCADE;
-- DROP TABLE nfe_item_backup CASCADE;

-- ====================================================================
-- NOTAS IMPORTANTES:
-- ====================================================================
-- 1. Após a migração, atualize o frontend (fetchRecords.ts, salesInvoices.ts)
-- 2. Atualize o workflow n8n para inserir direto na tabela nfe
-- 3. Novas NFes terão product_id e quantidade_kg NULL até serem preenchidos manualmente
-- 4. Mantenha os backups por alguns dias antes de deletar
-- ====================================================================
