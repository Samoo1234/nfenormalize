-- ====================================================================
-- LIMPAR TODOS OS DADOS DO SUPABASE - COMEÇAR DO ZERO
-- ====================================================================
-- ⚠️ ATENÇÃO: Este script irá DELETAR TODOS os dados das tabelas!
-- Execute apenas se tiver certeza que deseja recomeçar do zero.
-- ====================================================================

-- ====================================================================
-- PASSO 1: Limpar dados das tabelas (na ordem correta por FK)
-- ====================================================================

-- Deletar todos os registros da tabela de NFe
TRUNCATE TABLE public.nfe RESTART IDENTITY CASCADE;

-- Deletar todos os produtos (opcional - descomente se quiser)
-- TRUNCATE TABLE public.products RESTART IDENTITY CASCADE;

-- ====================================================================
-- PASSO 2: Adicionar constraint UNIQUE para evitar duplicatas futuras
-- ====================================================================

-- Remover constraint se já existir (para evitar erro)
ALTER TABLE public.nfe DROP CONSTRAINT IF EXISTS nfe_chave_nfe_unique;

-- Adicionar constraint UNIQUE na chave_nfe
ALTER TABLE public.nfe ADD CONSTRAINT nfe_chave_nfe_unique UNIQUE (chave_nfe);

-- ====================================================================
-- PASSO 3: Verificar que as tabelas estão vazias
-- ====================================================================

SELECT 'nfe' as tabela, COUNT(*) as registros FROM public.nfe
UNION ALL
SELECT 'products' as tabela, COUNT(*) as registros FROM public.products;

-- ====================================================================
-- PASSO 4: Verificar que a constraint foi criada
-- ====================================================================

SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'nfe' 
    AND tc.constraint_type = 'UNIQUE';

-- ====================================================================
-- RESULTADO ESPERADO:
-- tabela   | registros
-- nfe      | 0
-- products | (número de produtos, ou 0 se limpou também)
--
-- constraint_name         | constraint_type | column_name
-- nfe_chave_nfe_unique    | UNIQUE          | chave_nfe
-- ====================================================================

-- ====================================================================
-- AGORA VOCÊ PODE:
-- 1. Carregar os arquivos Excel novamente pelo frontend
-- 2. Os dados serão inseridos sem duplicatas
-- 3. Se carregar a mesma planilha duas vezes, o sistema atualizará
--    os registros existentes em vez de duplicar (se o n8n usar UPSERT)
-- ====================================================================
