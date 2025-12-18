import { supabase } from './lib/supabase';
async function checkSchema() {
    if (!supabase) {
        console.error('Supabase client not initialized');
        return;
    }
    console.log('=== ESTRUTURA DAS TABELAS ===\n');
    // Query para pegar estrutura das tabelas
    const { data: nfeColumns, error: nfeError } = await supabase
        .rpc('exec_sql', {
        query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'nfe'
        ORDER BY ordinal_position;
      `
    });
    if (nfeError) {
        // Tentar método alternativo - pegar dados de exemplo
        console.log('📦 Tabela: nfe');
        const { data: nfeSample, error: e1 } = await supabase
            .from('nfe')
            .select('*')
            .limit(1);
        if (nfeSample && nfeSample.length > 0) {
            console.log('Colunas encontradas:', Object.keys(nfeSample[0]));
            console.log('Exemplo de dados:', nfeSample[0]);
        }
        else {
            console.log('Erro ou tabela vazia:', e1?.message);
        }
    }
    console.log('\n📦 Tabela: nfe_item');
    const { data: nfeItemSample, error: e2 } = await supabase
        .from('nfe_item')
        .select('*')
        .limit(1);
    if (nfeItemSample && nfeItemSample.length > 0) {
        console.log('Colunas encontradas:', Object.keys(nfeItemSample[0]));
        console.log('Exemplo de dados:', nfeItemSample[0]);
    }
    else {
        console.log('Erro ou tabela vazia:', e2?.message);
    }
    console.log('\n📦 Tabela: products');
    const { data: productsSample, error: e3 } = await supabase
        .from('products')
        .select('*')
        .limit(1);
    if (productsSample && productsSample.length > 0) {
        console.log('Colunas encontradas:', Object.keys(productsSample[0]));
        console.log('Exemplo de dados:', productsSample[0]);
    }
    else {
        console.log('Erro ou tabela vazia:', e3?.message);
    }
    // Listar todas as tabelas
    console.log('\n📋 Todas as tabelas públicas:');
    const { data: allTables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
    if (allTables) {
        console.log(allTables.map(t => t.table_name));
    }
}
checkSchema()
    .then(() => console.log('\n✅ Consulta finalizada'))
    .catch(err => console.error('❌ Erro:', err));
