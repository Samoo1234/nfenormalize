import { supabase } from './supabase';
/**
 * Calcula a média ponderada de custo por kg de um produto
 * baseado em todas as notas de entrada (compra) desse produto.
 *
 * Fórmula: (Σ valor_total) ÷ (Σ quantidade_kg)
 *
 * Exemplo:
 * - Compra 1: 10 kg × R$ 75,00 (total) = R$ 7,50/kg
 * - Compra 2: 7 kg × R$ 17,00 (total) = R$ 2,43/kg
 * - Média ponderada: R$ 92,00 ÷ 17 kg = R$ 5,41/kg
 *
 * @param productId UUID do produto
 * @returns Média ponderada de custo por kg ou null se não houver dados
 */
export async function calculateAverageCostByProduct(productId) {
    if (!productId || productId.trim() === '') {
        return null;
    }
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    // Buscar todos os registros de NF-e de entrada (compra) para este produto
    const { data, error } = await supabase
        .from('nfe')
        .select('quantidade_kg, valor_total')
        .eq('product_id', productId)
        .eq('tipo', 'entrada')
        .not('quantidade_kg', 'is', null)
        .not('valor_total', 'is', null)
        .gt('quantidade_kg', 0);
    if (error) {
        console.error('Error fetching nfe for product:', error);
        throw new Error(`Failed to calculate average cost: ${error.message}`);
    }
    if (!data || data.length === 0) {
        return null;
    }
    let totalValue = 0;
    let totalQuantity = 0;
    for (const row of data) {
        if (row.quantidade_kg && row.valor_total) {
            totalValue += Number(row.valor_total);
            totalQuantity += Number(row.quantidade_kg);
        }
    }
    if (totalQuantity === 0) {
        return null;
    }
    const averageCost = totalValue / totalQuantity;
    return Number(averageCost.toFixed(6));
}
/**
 * Calcula o custo médio ponderado MÓVEL (diário) de um produto
 * considerando apenas as compras ATÉ uma data específica.
 *
 * Este é o cálculo correto para controle de estoque:
 * - Na data da venda, qual era o custo médio do produto?
 * - Considera apenas as compras que aconteceram ANTES ou NO DIA da venda
 *
 * Fórmula: (Σ valor_total até data) ÷ (Σ quantidade_kg até data)
 *
 * Exemplo:
 * - 01/12: Compra 100kg por R$ 1.000 → CMP = R$ 10,00/kg
 * - 05/12: Compra 200kg por R$ 2.400 → CMP = R$ 11,33/kg
 * - 10/12: Venda → usa CMP de R$ 11,33/kg (compras até 10/12)
 *
 * @param productId UUID do produto
 * @param untilDate Data limite (formato YYYY-MM-DD)
 * @returns Média ponderada até aquela data ou null se não houver compras
 */
export async function calculateDailyAverageCost(productId, untilDate) {
    if (!productId || productId.trim() === '') {
        return null;
    }
    if (!untilDate || untilDate.trim() === '') {
        return null;
    }
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    // Buscar compras do produto ATÉ a data especificada (inclusive)
    const { data, error } = await supabase
        .from('nfe')
        .select('quantidade_kg, valor_total, data_nota')
        .eq('product_id', productId)
        .eq('tipo', 'entrada')
        .lte('data_nota', untilDate) // <= data da venda
        .not('quantidade_kg', 'is', null)
        .not('valor_total', 'is', null)
        .gt('quantidade_kg', 0);
    if (error) {
        console.error('Error fetching nfe for daily average:', error);
        throw new Error(`Failed to calculate daily average cost: ${error.message}`);
    }
    if (!data || data.length === 0) {
        return null;
    }
    let totalValue = 0;
    let totalQuantity = 0;
    for (const row of data) {
        if (row.quantidade_kg && row.valor_total) {
            totalValue += Number(row.valor_total);
            totalQuantity += Number(row.quantidade_kg);
        }
    }
    if (totalQuantity === 0) {
        return null;
    }
    const averageCost = totalValue / totalQuantity;
    return Number(averageCost.toFixed(6));
}
/**
 * Atualiza o custo de venda por kg (valor_por_kg) de uma nota de saída específica
 *
 * @param nfeId UUID da NF-e
 * @param cost Novo custo de venda por kg
 * @returns true se atualizado com sucesso
 */
export async function updateSaleCostPerKg(nfeId, cost) {
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    const { error } = await supabase
        .from('nfe')
        .update({ valor_por_kg: cost })
        .eq('id', nfeId);
    if (error) {
        console.error('Error updating valor_por_kg:', error);
        throw new Error(`Failed to update sale cost: ${error.message}`);
    }
    return true;
}
/**
 * Exclui uma NF-e do banco de dados
 *
 * @param nfeId UUID da NF-e a ser excluída
 * @returns true se excluída com sucesso
 */
export async function deleteNfe(nfeId) {
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    const { error } = await supabase
        .from('nfe')
        .delete()
        .eq('id', nfeId);
    if (error) {
        console.error('Error deleting nfe:', error);
        throw new Error(`Failed to delete NF-e: ${error.message}`);
    }
    return true;
}
/**
 * Calcula o saldo de estoque APÓS uma saída específica.
 *
 * Fórmula:
 * 1. Total de Entradas (kg) até a data da saída
 * 2. Total de Saídas (kg) até e incluindo a data da saída
 * 3. Saldo = Entradas - Saídas
 * 4. Custo Médio = (Σ valor das entradas) ÷ (Σ kg das entradas)
 * 5. Valor em Estoque = Saldo × Custo Médio
 *
 * @param productId UUID do produto
 * @param untilDate Data limite (formato YYYY-MM-DD)
 * @param saleQuantity Quantidade da venda atual em kg
 * @returns Objeto com saldo, custo médio e valor em estoque
 */
export async function calculateStockBalanceAfterSale(productId, untilDate, saleQuantity) {
    if (!productId || productId.trim() === '') {
        return null;
    }
    if (!untilDate || untilDate.trim() === '') {
        return null;
    }
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    // 1. Buscar TODAS as entradas do produto ATÉ a data (inclusive)
    const { data: entriesData, error: entriesError } = await supabase
        .from('nfe')
        .select('quantidade_kg, valor_total')
        .eq('product_id', productId)
        .eq('tipo', 'entrada')
        .lte('data_nota', untilDate)
        .not('quantidade_kg', 'is', null)
        .not('valor_total', 'is', null)
        .gt('quantidade_kg', 0);
    if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        throw new Error(`Failed to fetch entries: ${entriesError.message}`);
    }
    // 2. Buscar TODAS as saídas do produto ATÉ a data (inclusive)
    // Isso inclui a saída atual
    const { data: exitsData, error: exitsError } = await supabase
        .from('nfe')
        .select('quantidade_kg')
        .eq('product_id', productId)
        .eq('tipo', 'saida')
        .lte('data_nota', untilDate)
        .not('quantidade_kg', 'is', null)
        .gt('quantidade_kg', 0);
    if (exitsError) {
        console.error('Error fetching exits:', exitsError);
        throw new Error(`Failed to fetch exits: ${exitsError.message}`);
    }
    // 3. Calcular totais de entradas
    let totalEntriesKg = 0;
    let totalEntriesValue = 0;
    for (const entry of entriesData || []) {
        if (entry.quantidade_kg && entry.valor_total) {
            totalEntriesKg += Number(entry.quantidade_kg);
            totalEntriesValue += Number(entry.valor_total);
        }
    }
    // 4. Calcular total de saídas (do banco)
    let totalExitsKg = 0;
    for (const exit of exitsData || []) {
        if (exit.quantidade_kg) {
            totalExitsKg += Number(exit.quantidade_kg);
        }
    }
    // Se não há entradas, não há estoque
    if (totalEntriesKg === 0) {
        return {
            balanceKg: 0,
            averageCost: 0,
            stockValue: 0,
            totalEntries: 0,
            totalExits: totalExitsKg
        };
    }
    // 5. Calcular custo médio das entradas
    const averageCost = totalEntriesValue / totalEntriesKg;
    // 6. Calcular saldo (pode ser negativo se há mais saídas que entradas)
    const balanceKg = totalEntriesKg - totalExitsKg;
    // 7. Calcular valor em estoque
    const stockValue = balanceKg * averageCost;
    return {
        balanceKg: Number(balanceKg.toFixed(3)),
        averageCost: Number(averageCost.toFixed(6)),
        stockValue: Number(stockValue.toFixed(2)),
        totalEntries: Number(totalEntriesKg.toFixed(3)),
        totalExits: Number(totalExitsKg.toFixed(3))
    };
}
/**
 * Calcula o saldo de estoque para múltiplas saídas de uma vez
 * Útil para exibir na tabela de saídas
 *
 * @param sales Array de saídas com productId, date e quantity
 * @returns Map de nfeId para resultado de saldo
 */
export async function calculateStockBalanceForSales(sales) {
    const results = new Map();
    for (const sale of sales) {
        if (!sale.productId || !sale.date)
            continue;
        try {
            const balance = await calculateStockBalanceAfterSale(sale.productId, sale.date, sale.quantity);
            if (balance) {
                results.set(sale.nfeId, balance);
            }
        }
        catch (error) {
            console.error(`Error calculating balance for sale ${sale.nfeId}:`, error);
        }
    }
    return results;
}
