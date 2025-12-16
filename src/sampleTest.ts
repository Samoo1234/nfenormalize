import * as XLSX from 'xlsx';
import { processExcel } from './excelProcessor';

const wb = XLSX.utils.book_new();
const compras = XLSX.utils.aoa_to_sheet([
  ['Número NF', 'Data Emissão', 'Produto', 'Quantidade (kg)', 'Valor Total', 'Tipo'],
  ['12345', '10/11/2025', 'Carne Bovina', '1500,00', 'R$ 75.000,00', 'Compra'],
  ['12346', '2025-11-12', 'Frango', '2.500', 'R$ 50.000,00', 'Compra'],
]);
XLSX.utils.book_append_sheet(wb, compras, 'Compras');

const vendas = XLSX.utils.aoa_to_sheet([
  ['NF-e', 'Emissão', 'Item', 'Qtd', 'Total', 'Tipo'],
  ['98765', '12/11/2025', 'Carne Bovina', '1000', 'R$ 90.000,00', 'Venda'],
  ['98766', '13-11-2025', 'Frango', '1500', '120000.00', 'Venda'],
]);
XLSX.utils.book_append_sheet(wb, vendas, 'Vendas');

const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
const output = processExcel(buf);
process.stdout.write(JSON.stringify(output, null, 2));
