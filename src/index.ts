import * as path from 'path';
import * as dotenv from 'dotenv';
import { processExcel } from './excelProcessor';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const argPath = process.argv[2];
const envPath = process.env.EXCEL_FILE;
const filePath = argPath ?? envPath ?? null;
if (!filePath) {
  console.error('Usage: process-excel <file.xlsx> or set EXCEL_FILE in .env.local');
  process.exit(1);
}
const output = processExcel(filePath);
process.stdout.write(JSON.stringify(output, null, 2));
