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
export async function calculateAverageCostByProduct(productId: string): Promise<number | null> {
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
 * Atualiza o custo de venda por kg (valor_por_kg) de uma nota de saída específica
 * 
 * @param nfeId UUID da NF-e
 * @param cost Novo custo de venda por kg
 * @returns true se atualizado com sucesso
 */
export async function updateSaleCostPerKg(nfeId: string, cost: number | null): Promise<boolean> {
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
export async function deleteNfe(nfeId: string): Promise<boolean> {
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
