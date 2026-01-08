-- ====================================================================
-- CORREÇÃO DE DUPLICAÇÃO DE NFe
-- ====================================================================
-- Execute este script no Supabase SQL Editor
-- IMPORTANTE: Faça backup antes de executar em produção!
-- ====================================================================

-- ====================================================================
-- PASSO 1: Verificar duplicatas existentes
-- ====================================================================
SELECT chave_nfe, COUNT(*) as quantidade_duplicatas
FROM nfe 
WHERE chave_nfe IS NOT NULL 
GROUP BY chave_nfe 
HAVING COUNT(*) > 1
ORDER BY quantidade_duplicatas DESC;

-- ====================================================================
-- PASSO 2: Remover duplicatas (mantém o registro mais recente)
-- ====================================================================
-- Este comando deleta registros duplicados mantendo apenas o mais recente
-- baseado no campo created_at

DELETE FROM nfe a
USING nfe b
WHERE a.chave_nfe = b.chave_nfe
  AND a.chave_nfe IS NOT NULL
  AND a.created_at < b.created_at;

-- ====================================================================
-- PASSO 3: Verificar que não há mais duplicatas
-- ====================================================================
SELECT chave_nfe, COUNT(*) as quantidade_duplicatas
FROM nfe 
WHERE chave_nfe IS NOT NULL 
GROUP BY chave_nfe 
HAVING COUNT(*) > 1;
-- Esta query deve retornar 0 resultados

-- ====================================================================
-- PASSO 4: Adicionar constraint UNIQUE
-- ====================================================================
ALTER TABLE public.nfe 
ADD CONSTRAINT nfe_chave_nfe_unique UNIQUE (chave_nfe);

-- ====================================================================
-- PASSO 5: Verificar que a constraint foi criada
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
-- constraint_name         | constraint_type | column_name
-- nfe_chave_nfe_unique    | UNIQUE          | chave_nfe
-- ====================================================================

-- ====================================================================
-- CONFIGURAÇÃO DO N8N (após executar os passos acima)
-- ====================================================================
/*
No workflow n8n, substitua o node de INSERT por um SQL customizado:

INSERT INTO nfe (
    chave_nfe, 
    numero_nota, 
    data_nota, 
    tipo, 
    emitente, 
    destinatario, 
    valor_total
)
VALUES (
    '{{ $json.chaveNota }}',
    '{{ $json.numeroNota }}',
    '{{ $json.dataEmissao }}',
    '{{ $json.tipo }}',
    '{{ $json.emitente }}',
    '{{ $json.destinatario }}',
    {{ $json.valorProduto }}
)
ON CONFLICT (chave_nfe) 
DO UPDATE SET
    numero_nota = EXCLUDED.numero_nota,
    data_nota = EXCLUDED.data_nota,
    tipo = EXCLUDED.tipo,
    emitente = EXCLUDED.emitente,
    destinatario = EXCLUDED.destinatario,
    valor_total = EXCLUDED.valor_total,
    updated_at = NOW();

Isso garantirá que:
- Novas NFes serão inseridas normalmente
- NFes existentes serão ATUALIZADAS em vez de duplicadas
- O campo product_id e quantidade_kg não serão sobrescritos (preserva dados manuais)
*/
