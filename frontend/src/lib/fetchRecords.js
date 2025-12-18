import { supabase } from './supabase';
export async function fetchRecords(filters) {
    if (!supabase) {
        throw new Error('Supabase client not initialized. Check your environment variables.');
    }
    // Construir query base
    let query = supabase
        .from('nfe')
        .select(`
      id,
      numero_nota,
      chave_nfe,
      data_nota,
      tipo,
      emitente,
      product_id,
      quantidade_kg,
      valor_por_kg,
      valor_total,
      products (
        id,
        nome
      )
    `);
    // Aplicar filtro de data se fornecido
    if (filters?.startDate) {
        query = query.gte('data_nota', filters.startDate);
    }
    if (filters?.endDate) {
        query = query.lte('data_nota', filters.endDate);
    }
    // Ordenar por data
    const { data: nfeData, error: nfeError } = await query.order('data_nota', { ascending: true });
    if (nfeError) {
        console.error('Error fetching nfe:', nfeError);
        throw new Error(`Failed to fetch NF-e: ${nfeError.message}`);
    }
    // CNPJ da empresa para identificar notas de saída
    const CNPJ_EMPRESA = '27.244.973/0001-22';
    // Transformar dados para formato normalizado
    const records = [];
    for (const nfe of nfeData || []) {
        // O Supabase retorna products como objeto único em relação many-to-one
        const product = nfe.products;
        const productName = product?.nome || null;
        // Determinar tipo baseado no emitente:
        // Se emitente contém o CNPJ da empresa = saída (venda)
        // Caso contrário = entrada (compra)
        const emitente = nfe.emitente || '';
        const isEmpresaEmitente = emitente.includes('27244973000122') ||
            emitente.includes('27.244.973/0001-22') ||
            emitente.includes(CNPJ_EMPRESA.replace(/\D/g, ''));
        const invoiceType = isEmpresaEmitente ? 'sale' : 'purchase';
        const record = {
            invoice_type: invoiceType,
            invoice_number: nfe.numero_nota || null,
            chave_nfe: nfe.chave_nfe || null,
            invoice_date: nfe.data_nota || null,
            product: productName,
            quantity_kg: nfe.quantidade_kg || null,
            total_value: nfe.valor_total || null,
            average_cost_per_kg: null,
            sale_cost_per_kg: null,
            id: nfe.id,
            product_id: nfe.product_id,
        };
        // Calcular average_cost_per_kg para compras
        if (invoiceType === 'purchase' && nfe.valor_total && nfe.quantidade_kg && nfe.quantidade_kg > 0) {
            record.average_cost_per_kg = Number((nfe.valor_total / nfe.quantidade_kg).toFixed(6));
        }
        // Para vendas, usar valor_por_kg se disponível
        if (invoiceType === 'sale' && nfe.valor_por_kg) {
            record.sale_cost_per_kg = nfe.valor_por_kg;
        }
        records.push(record);
    }
    return {
        status: 'success',
        source: 'supabase',
        environment: {
            frontend: 'React + TypeScript + Tailwind',
            database: 'Supabase',
            automation: 'n8n',
        },
        records,
    };
}
