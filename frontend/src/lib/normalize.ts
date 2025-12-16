import * as XLSX from 'xlsx';

type InvoiceType = 'purchase' | 'sale' | null;

export type NormalizedRecord = {
  invoice_type: InvoiceType;
  invoice_number: string | null;
  chave_nfe?: string | null;
  invoice_date: string | null;
  product: string | null;
  quantity_kg: number | null;
  total_value: number | null;
  average_cost_per_kg: number | null;
  sale_cost_per_kg: number | null;
  id?: number | string;
  nfe_id?: string;
  product_id?: string;
};

export type NormalizedOutput = {
  status: 'success';
  source: 'excel' | 'supabase';
  environment: {
    frontend: 'React + TypeScript + Tailwind';
    database: 'Supabase';
    automation: 'n8n';
  };
  records: NormalizedRecord[];
};

function normalizeKey(k: string): string {
  return k
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function pickValue(row: Record<string, any>, keys: string[]): any {
  const map = new Map<string, any>();
  Object.keys(row).forEach((k) => map.set(normalizeKey(k), row[k]));
  for (const key of keys) {
    const nk = normalizeKey(key);
    for (const candidate of map.keys()) {
      if (candidate === nk) return map.get(candidate);
      if (candidate.includes(nk)) return map.get(candidate);
    }
  }
  return null;
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const s0 = v.trim();
  if (s0.length === 0) return null;
  const s1 = s0.replace(/[^0-9,.-]/g, '');
  if (!s1) return null;
  const lastDot = s1.lastIndexOf('.');
  const lastComma = s1.lastIndexOf(',');
  let s2 = s1;
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      s2 = s1.replace(/\./g, '').replace(',', '.');
    } else {
      s2 = s1.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s2 = s1.replace(',', '.');
  }
  const n = parseFloat(s2);
  if (!isFinite(n)) return null;
  return n;
}

function toIsoDate(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number' && isFinite(v)) {
    const parsed = (XLSX as any).SSF?.parse_date_code?.(v);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmY1 = s.match(/^([0-3]?\d)[-/]([0-1]?\d)[-/](\d{4})$/);
    if (dmY1) {
      const d = dmY1[1].padStart(2, '0');
      const m = dmY1[2].padStart(2, '0');
      const y = dmY1[3];
      return `${y}-${m}-${d}`;
    }
    const mdY1 = s.match(/^([0-1]?\d)[-/]([0-3]?\d)[-/](\d{4})$/);
    if (mdY1) {
      const m = mdY1[1].padStart(2, '0');
      const d = mdY1[2].padStart(2, '0');
      const y = mdY1[3];
      return `${y}-${m}-${d}`;
    }
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) {
      const y = d1.getFullYear();
      const m = String(d1.getMonth() + 1).padStart(2, '0');
      const d = String(d1.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

function detectInvoiceType(row: Record<string, any>, sheetName: string): InvoiceType {
  const typeVal = pickValue(row, [
    'Tipo',
    'Tipo NF',
    'Entrada/Saida',
    'Entrada/Saída',
    'Natureza',
    'Operacao',
    'Operação',
    'Operation',
  ]);
  const s = typeof typeVal === 'string' ? typeVal.trim().toLowerCase() : '';
  if (s) {
    if (s.includes('compra') || s.includes('entrada') || s.includes('purchase')) return 'purchase';
    if (s.includes('venda') || s.includes('saida') || s.includes('saída') || s.includes('sale')) return 'sale';
  }
  const sn = sheetName.trim().toLowerCase();
  if (sn.includes('compra')) return 'purchase';
  if (sn.includes('venda')) return 'sale';
  if (sn.includes('entrada')) return 'purchase';
  if (sn.includes('saida') || sn.includes('saída')) return 'sale';
  return null;
}

function recordFromRow(row: Record<string, any>, sheetName: string): NormalizedRecord {
  const invoiceNumberRaw = pickValue(row, [
    'NF-e',
    'NFe',
    'Nota Fiscal',
    'Numero',
    'Número',
    'Número NF',
    'Numero NF',
    'Chave',
    'Invoice Number',
  ]);
  const invoiceDateRaw = pickValue(row, [
    'Data',
    'Data Emissao',
    'Data Emissão',
    'Emissao',
    'Emissão',
    'Invoice Date',
  ]);
  const productRaw = pickValue(row, [
    'Produto',
    'Descricao',
    'Descrição',
    'Item',
    'Product',
  ]);
  const quantityRaw = pickValue(row, [
    'Quantidade (kg)',
    'Quantidade',
    'Qtde',
    'Qtd',
    'Kg',
    'Peso',
  ]);
  const totalValueRaw = pickValue(row, [
    'Valor',
    'Valor Total',
    'Total',
    'Total Nota',
    'Valor Nota',
    'Preco Total',
    'Preço Total',
    'Amount',
    'Sale Amount',
  ]);
  const invoice_type = detectInvoiceType(row, sheetName);
  const invoice_number = typeof invoiceNumberRaw === 'string' || typeof invoiceNumberRaw === 'number' ? String(invoiceNumberRaw).trim() || null : null;
  const invoice_date = toIsoDate(invoiceDateRaw);
  const product = typeof productRaw === 'string' ? productRaw.trim() || null : productRaw === null || productRaw === undefined ? null : String(productRaw);
  const quantity_kg = toNumber(quantityRaw);
  const total_value = toNumber(totalValueRaw);
  let average_cost_per_kg: number | null = null;
  if (invoice_type === 'purchase' && typeof total_value === 'number' && typeof quantity_kg === 'number' && quantity_kg > 0) {
    average_cost_per_kg = Number((total_value / quantity_kg).toFixed(6));
  }
  const sale_cost_per_kg = null;
  return {
    invoice_type,
    invoice_number,
    invoice_date,
    product,
    quantity_kg,
    total_value,
    average_cost_per_kg,
    sale_cost_per_kg,
  };
}

export async function processExcelArrayBuffer(buf: ArrayBuffer): Promise<NormalizedOutput> {
  const wb = XLSX.read(buf, { type: 'array' });
  const records: NormalizedRecord[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    for (const row of rows) {
      const rec = recordFromRow(row, sheetName);
      records.push(rec);
    }
  }
  const output: NormalizedOutput = {
    status: 'success',
    source: 'excel',
    environment: {
      frontend: 'React + TypeScript + Tailwind',
      database: 'Supabase',
      automation: 'n8n',
    },
    records,
  };
  return output;
}
