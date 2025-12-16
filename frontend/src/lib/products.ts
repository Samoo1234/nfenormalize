import { supabase } from './supabase';

export type ProductOption = {
  id: string;
  nome: string;
};

export async function fetchProductOptions(): Promise<ProductOption[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data || [];
}

export async function insertProduct(nome: string): Promise<ProductOption | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('products')
    .insert({ nome })
    .select('id, nome')
    .single();

  if (error) {
    console.error('Error inserting product:', error);
    throw new Error(error.message);
  }

  return data;
}
