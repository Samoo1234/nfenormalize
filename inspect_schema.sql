-- Query para ver estrutura da tabela nfe
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'nfe'
ORDER BY ordinal_position;

-- Query para ver estrutura da tabela nfe_item
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'nfe_item'
ORDER BY ordinal_position;

-- Query para ver estrutura da tabela products
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'products'
ORDER BY ordinal_position;

-- Ver dados de exemplo
SELECT * FROM nfe LIMIT 3;
SELECT * FROM nfe_item LIMIT 3;
SELECT * FROM products LIMIT 3;
