import { supabase } from './supabase';
export async function debugSchema() {
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    const results = {
        tables: [],
        samples: {}
    };
    // Tentar pegar amostra de cada tabela
    const tables = ['nfe', 'nfe_item', 'products'];
    for (const tableName of tables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
            if (error) {
                results.samples[tableName] = { error: error.message };
            }
            else if (data && data.length > 0) {
                results.samples[tableName] = {
                    columns: Object.keys(data[0]),
                    columnTypes: Object.entries(data[0]).map(([key, value]) => ({
                        column: key,
                        type: typeof value,
                        sampleValue: value
                    })),
                    sampleData: data[0]
                };
                results.tables.push(tableName);
            }
            else {
                results.samples[tableName] = { empty: true };
            }
        }
        catch (err) {
            results.samples[tableName] = { error: err.message };
        }
    }
    return results;
}
