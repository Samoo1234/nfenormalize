# Atualização do Workflow n8n para Schema NFe Simplificado

## ⚠️ Mudanças Necessárias

Com a simplificação do schema NFe (junção de `nfe` + `nfe_item` em uma única tabela `nfe`), o workflow n8n precisa ser atualizado.

## Mapeamento Anterior (com duas tabelas)

```javascript
// Fields to Send no Supabase Insert (tabela nfe_item):
{
  "nfe_id": "{{ $json.nfeId }}",
  "product_id": null,
  "quantidade_kg": null,
  "valor_total": "{{ $json.valorProduto }}"
}
```

## Novo Mapeamento (tabela única)

```javascript
// Fields to Send no Supabase Insert (tabela nfe):
{
  "numero_nota": "{{ $json.chaveNota }}",
  "data_nota": "{{ $json.dataFormatada }}",
  "tipo": "{{ $json.tipo }}",              // 'entrada' ou 'saida'
  "product_id": null,                       // Preenchido manualmente depois
  "quantidade_kg": null,                    // Preenchido manualmente depois
  "valor_por_kg": null,                     // Opcional
  "valor_total": "{{ $json.valorProduto }}"
}
```

## Passos para Atualizar o Workflow

1. **Abrir workflow n8n** de importação de NFes
2. **Localizar o node "Supabase Insert"**
3. **Atualizar a tabela:**
   - De: `nfe_item`
   - Para: `nfe`
4. **Atualizar os campos** conforme o novo mapeamento acima
5. **Ativar o workflow** novamente

## Verificação

Após atualizar:
- Executar o workflow com um XML de teste
- Verificar no Supabase se o registro foi inserido na tabela `nfe`
- Confirmar que os campos `product_id` e `quantidade_kg` estão NULL
- Editar manualmente o registro para preencher produto e quantidade

## Fluxo Completo Atualizado

1. **n8n** → Importa NFe do XML e insere em `nfe` (produto NULL)
2. **Frontend** → Usuário abre a nota e preenche manualmente o produto e quantidade
3. **Frontend** → Cálculo automático da média ponderada de custo
