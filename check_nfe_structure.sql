-- ====================================================================
-- Script para Verificar Estrutura da Tabela NFe
-- ====================================================================

-- 1. Listar todas as colunas da tabela nfe
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nfe'
ORDER BY ordinal_position;

-- 2. Verificar constraints (chaves primárias, foreign keys, checks)
SELECT
    con.conname as constraint_name,
    con.contype as constraint_type,
    CASE con.contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        WHEN 'u' THEN 'UNIQUE'
    END as constraint_description,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'nfe';

-- 3. Verificar índices
SELECT
    i.relname as index_name,
    a.attname as column_name,
    am.amname as index_type
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON i.relam = am.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = 'nfe'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY i.relname, a.attnum;

-- 4. Ver estrutura completa resumida
SELECT 
    'Column: ' || column_name || 
    ' | Type: ' || data_type || 
    CASE WHEN character_maximum_length IS NOT NULL 
         THEN '(' || character_maximum_length || ')' 
         ELSE '' END ||
    ' | Nullable: ' || is_nullable ||
    CASE WHEN column_default IS NOT NULL 
         THEN ' | Default: ' || column_default 
         ELSE '' END as column_info
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nfe'
ORDER BY ordinal_position;

-- 5. Contar registros e verificar dados
SELECT 
    COUNT(*) as total_registros,
    COUNT(numero_nota) as com_numero_nota,
    COUNT(product_id) as com_produto,
    COUNT(quantidade_kg) as com_quantidade
FROM nfe;
