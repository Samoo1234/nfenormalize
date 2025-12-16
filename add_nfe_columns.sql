-- ====================================================================
-- Adicionar Colunas de Emitente e Destinatário à Tabela NFe
-- ====================================================================
-- Script para adicionar colunas faltantes do XML NFe
-- ====================================================================

-- Adicionar colunas para emitente e destinatário
ALTER TABLE public.nfe 
  ADD COLUMN IF NOT EXISTS emitente TEXT,
  ADD COLUMN IF NOT EXISTS destinatario TEXT,
  ADD COLUMN IF NOT EXISTS chave_nfe TEXT;

-- Adicionar índice para chave_nfe (útil para buscas)
CREATE INDEX IF NOT EXISTS idx_nfe_chave_nfe ON public.nfe(chave_nfe);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.nfe.emitente IS 'Nome ou CNPJ do emitente da NFe';
COMMENT ON COLUMN public.nfe.destinatario IS 'Nome ou CNPJ do destinatário da NFe';
COMMENT ON COLUMN public.nfe.chave_nfe IS 'Chave de acesso da NFe (44 caracteres)';

-- Verificar estrutura atualizada
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nfe'
ORDER BY ordinal_position;

-- ====================================================================
-- Informações de Mapeamento para n8n
-- ====================================================================
/*
Após executar este script, atualize o workflow n8n com:

{
  "chave_nfe": "{{ $json.chaveNota }}",        // Chave completa da NFe
  "numero_nota": "{{ $json.numeroNota }}",     // Número da nota (se disponível)
  "data_nota": "{{ $json.dataEmissao }}",      // Data de emissão
  "tipo": "{{ $json.tipo }}",                  // entrada ou saida
  "emitente": "{{ $json.emitente }}",          // Nome/CNPJ emitente
  "destinatario": "{{ $json.destinatario }}",  // Nome/CNPJ destinatário
  "valor_total": "{{ $json.valorProduto }}",   // Valor total
  "product_id": null,                          // Preenchido manualmente
  "quantidade_kg": null                        // Preenchido manualmente
}
*/
