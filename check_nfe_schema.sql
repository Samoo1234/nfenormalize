-- ============================================================
-- SCRIPT PARA VERIFICAR ESTRUTURA DA TABELA NFE NO SUPABASE
-- ============================================================

-- 1. Ver todas as colunas da tabela nfe
SELECT 
    column_name AS "Coluna",
    data_type AS "Tipo",
    character_maximum_length AS "Tamanho Máximo",
    is_nullable AS "Permite NULL",
    column_default AS "Valor Padrão"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nfe'
ORDER BY ordinal_position;

-- 2. Ver constraints (NOT NULL, CHECK, etc)
SELECT
    tc.constraint_name AS "Nome Constraint",
    tc.constraint_type AS "Tipo",
    kcu.column_name AS "Coluna",
    cc.check_clause AS "Condição CHECK"
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'nfe'
ORDER BY tc.constraint_type, kcu.column_name;

-- 3. Ver alguns dados de exemplo
SELECT *
FROM nfe
LIMIT 3;

-- 4. Ver somente os nomes das colunas
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nfe'
ORDER BY ordinal_position;
