import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { processExcelArrayBuffer } from './lib/normalize';
import { fetchRecords } from './lib/fetchRecords';
import { fetchProductOptions, insertProduct } from './lib/products';
import { calculateDailyAverageCost, updateSaleCostPerKg, deleteNfe, calculateStockBalanceForSales } from './lib/salesInvoices';
// Função para formatar data no formato brasileiro (DD/MM/YYYY)
function formatDateBR(dateStr) {
    if (!dateStr)
        return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}
// Função para formatar valor monetário brasileiro (R$ X.XXX,XX)
function formatCurrencyBR(value) {
    if (value === null || value === undefined)
        return '-';
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
// Função para formatar a chave NFe
function formatChaveNfe(chave) {
    if (!chave)
        return '-';
    return chave;
}
// Função para obter nome do mês em português
function getMonthName(month) {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[month];
}
// Função para extrair mês/ano de uma data no formato YYYY-MM-DD
function getMonthYear(dateStr) {
    if (!dateStr)
        return null;
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        return `${parts[0]}-${parts[1]}`; // YYYY-MM
    }
    return null;
}
export default function App() {
    const [output, setOutput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [products, setProducts] = useState([]);
    const [rowOverrides, setRowOverrides] = useState({});
    const [newProductName, setNewProductName] = useState('');
    const [addingProduct, setAddingProduct] = useState(false);
    const [productMsg, setProductMsg] = useState(null);
    const [noteType, setNoteType] = useState('');
    const [view, setView] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' ou 'YYYY-MM'
    const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD para filtro por dia
    const [editingSaleCost, setEditingSaleCost] = useState({});
    const [calculatingAverage, setCalculatingAverage] = useState({});
    const [deleting, setDeleting] = useState({});
    const [stockBalances, setStockBalances] = useState(new Map());
    const effectiveOutput = useMemo(() => {
        if (!output)
            return null;
        const updated = output.records.map((r, i) => {
            const o = rowOverrides[i] ?? {};
            const product = o.product ?? r.product ?? null;
            const qStr = o.quantity_kg ?? (typeof r.quantity_kg === 'number' ? String(r.quantity_kg) : '');
            const quantity_kg = qStr ? Number(qStr.replace(',', '.')) : r.quantity_kg ?? null;
            // Manter o tipo original do banco de dados (baseado em emitente)
            // noteType é apenas para indicar o tipo ao enviar para n8n
            const invoice_type = r.invoice_type;
            let average_cost_per_kg = r.average_cost_per_kg;
            if (invoice_type === 'purchase' && typeof r.total_value === 'number' && typeof quantity_kg === 'number' && quantity_kg > 0) {
                average_cost_per_kg = Number((r.total_value / quantity_kg).toFixed(6));
            }
            return { ...r, invoice_type, product, quantity_kg, average_cost_per_kg };
        });
        return { ...output, records: updated };
    }, [output, rowOverrides]);
    const records = useMemo(() => effectiveOutput?.records ?? [], [effectiveOutput]);
    // Obter lista de meses disponíveis baseado nos registros
    const availableMonths = useMemo(() => {
        const monthsSet = new Set();
        records.forEach(r => {
            const monthYear = getMonthYear(r.invoice_date);
            if (monthYear)
                monthsSet.add(monthYear);
        });
        const sorted = Array.from(monthsSet).sort().reverse(); // Mais recentes primeiro
        return sorted.map(my => {
            const [year, month] = my.split('-');
            return {
                value: my,
                label: `${getMonthName(parseInt(month) - 1)} ${year}`
            };
        });
    }, [records]);
    // Filtro combinado: tipo de nota + mês
    const filteredRecords = useMemo(() => {
        let filtered = records;
        // Filtro por tipo (entrada/saída)
        if (view !== 'all') {
            filtered = filtered.filter((r) => r.invoice_type === view);
        }
        // Filtro por mês
        if (selectedMonth !== 'all') {
            filtered = filtered.filter((r) => getMonthYear(r.invoice_date) === selectedMonth);
        }
        return filtered;
    }, [records, view, selectedMonth]);
    // Contagem de registros para cada tipo (considerando filtro de mês)
    const monthFilteredRecords = useMemo(() => {
        if (selectedMonth === 'all')
            return records;
        return records.filter((r) => getMonthYear(r.invoice_date) === selectedMonth);
    }, [records, selectedMonth]);
    const countPurchase = useMemo(() => monthFilteredRecords.filter((r) => r.invoice_type === 'purchase').length, [monthFilteredRecords]);
    const countSale = useMemo(() => monthFilteredRecords.filter((r) => r.invoice_type === 'sale').length, [monthFilteredRecords]);
    // Calcular custo médio ponderado ACUMULADO para cada registro de compra
    // Agrupa por produto e ordena por data para calcular o custo médio móvel
    const accumulatedAverageCosts = useMemo(() => {
        const result = {};
        // Filtrar apenas compras e ordenar por data
        const purchases = records
            .filter(r => r.invoice_type === 'purchase' && r.product && r.quantity_kg && r.total_value)
            .sort((a, b) => {
            // Ordenar por data, depois por produto
            const dateA = a.invoice_date || '';
            const dateB = b.invoice_date || '';
            if (dateA !== dateB)
                return dateA.localeCompare(dateB);
            return (a.product || '').localeCompare(b.product || '');
        });
        // Acumuladores por produto
        const accumulators = {};
        for (const purchase of purchases) {
            const productKey = purchase.product || '';
            if (!productKey)
                continue;
            // Inicializar acumulador se não existe
            if (!accumulators[productKey]) {
                accumulators[productKey] = { totalQty: 0, totalValue: 0 };
            }
            // Acumular valores
            accumulators[productKey].totalQty += Number(purchase.quantity_kg) || 0;
            accumulators[productKey].totalValue += Number(purchase.total_value) || 0;
            // Calcular média acumulada e armazenar pelo ID do registro
            if (purchase.id && accumulators[productKey].totalQty > 0) {
                const avgCost = accumulators[productKey].totalValue / accumulators[productKey].totalQty;
                result[String(purchase.id)] = Number(avgCost.toFixed(6));
            }
        }
        return result;
    }, [records]);
    async function onFileChange(e) {
        const file = e.target.files?.[0] ?? null;
        if (!file)
            return;
        setSelectedFile(file);
        setError(null);
        setLoading(true);
        try {
            const buf = await file.arrayBuffer();
            const res = await processExcelArrayBuffer(buf);
            setOutput(res);
        }
        catch (err) {
            setError(String(err?.message ?? err ?? 'Erro ao processar arquivo'));
        }
        finally {
            setLoading(false);
        }
    }
    async function onLoadSupabase(dateFilter) {
        setError(null);
        setLoading(true);
        try {
            // Se tiver filtro de data, busca apenas o dia específico
            const filters = {};
            const dateToUse = dateFilter ?? selectedDate;
            if (dateToUse) {
                filters.startDate = dateToUse;
                filters.endDate = dateToUse;
            }
            const res = await fetchRecords(filters);
            setOutput(res);
            // Calcular saldos de estoque para todas as saídas
            const sales = res.records
                .filter(r => r.invoice_type === 'sale' && r.product_id && r.invoice_date)
                .map(r => ({
                nfeId: String(r.id),
                productId: r.product_id,
                date: r.invoice_date,
                quantity: r.quantity_kg || 0
            }));
            if (sales.length > 0) {
                const balances = await calculateStockBalanceForSales(sales);
                setStockBalances(balances);
            }
        }
        catch (err) {
            setError(String(err?.message ?? err ?? 'Erro ao carregar do Supabase'));
        }
        finally {
            setLoading(false);
        }
    }
    // Função para carregar dados quando a data mudar
    async function onDateChange(date) {
        setSelectedDate(date);
        if (date) {
            await onLoadSupabase(date);
        }
    }
    useEffect(() => {
        (async () => {
            const opts = await fetchProductOptions();
            setProducts(opts);
        })();
    }, []);
    async function onSendToN8n() {
        if (!selectedFile) {
            setError('Selecione um arquivo Excel primeiro');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const url = import.meta.env?.VITE_N8N_WEBHOOK_URL ?? '/webhook-test/excel-upload';
            const fd = new FormData();
            fd.append('file', selectedFile);
            fd.append('source', 'frontend');
            if (noteType)
                fd.append('invoice_type', noteType);
            const overridesArray = Object.entries(rowOverrides).map(([k, v]) => ({
                index: Number(k),
                product: v.product ?? null,
                quantity_kg: v.quantity_kg ? Number(v.quantity_kg.replace(',', '.')) : null,
            }));
            if (overridesArray.length > 0)
                fd.append('row_overrides', JSON.stringify(overridesArray));
            const resp = await fetch(url, { method: 'POST', body: fd, mode: 'cors', credentials: 'omit' });
            const text = await resp.text();
            let json = null;
            try {
                json = JSON.parse(text);
            }
            catch { }
            if (!resp.ok) {
                const msg = json?.message ?? text ?? 'Falha ao enviar para n8n';
                throw new Error(msg);
            }
            const tip = json?.hint ?? '';
            if (tip) {
                setError(tip);
            }
            const res = await fetchRecords();
            setOutput(res);
        }
        catch (err) {
            const m = String(err?.message ?? err ?? 'Erro ao enviar para n8n');
            try {
                const url = import.meta.env?.VITE_N8N_WEBHOOK_URL ?? '/webhook-test/excel-upload';
                const fd = new FormData();
                if (selectedFile)
                    fd.append('file', selectedFile);
                fd.append('source', 'frontend');
                if (noteType)
                    fd.append('invoice_type', noteType);
                const overridesArray = Object.entries(rowOverrides).map(([k, v]) => ({
                    index: Number(k),
                    product: v.product ?? null,
                    quantity_kg: v.quantity_kg ? Number(v.quantity_kg.replace(',', '.')) : null,
                }));
                if (overridesArray.length > 0)
                    fd.append('row_overrides', JSON.stringify(overridesArray));
                await fetch(url, { method: 'POST', body: fd, mode: 'no-cors', credentials: 'omit' });
                setError('Solicitação enviada ao n8n (sem confirmação por CORS).');
            }
            catch { }
            try {
                const res = await fetchRecords();
                setOutput(res);
            }
            catch { }
        }
        finally {
            setLoading(false);
        }
    }
    async function onInsertProduct() {
        setProductMsg(null);
        const name = newProductName.trim();
        if (!name) {
            setProductMsg('Informe o nome do produto');
            return;
        }
        setAddingProduct(true);
        try {
            const created = await insertProduct(name);
            if (!created) {
                setProductMsg('Falha ao inserir produto');
            }
            else {
                setProducts((prev) => [{ id: created.id, nome: created.nome }, ...prev]);
                setNewProductName('');
                setProductMsg('Produto adicionado');
            }
        }
        catch (e) {
            setProductMsg(String(e?.message ?? e ?? 'Erro ao inserir produto'));
        }
        finally {
            setAddingProduct(false);
        }
    }
    function setRowProduct(i, val) {
        setRowOverrides((prev) => ({ ...prev, [i]: { ...(prev[i] ?? {}), product: val } }));
    }
    function setRowQuantity(i, val) {
        setRowOverrides((prev) => ({ ...prev, [i]: { ...(prev[i] ?? {}), quantity_kg: val } }));
    }
    async function onCalculateAverage(record, index) {
        if (!record.product_id || !record.id)
            return;
        // Usa a data da nota de venda para calcular o custo médio até aquela data
        const saleDate = record.invoice_date;
        if (!saleDate) {
            setError('Nota sem data. Não é possível calcular o custo médio.');
            return;
        }
        setCalculatingAverage((prev) => ({ ...prev, [index]: true }));
        try {
            // Calcula custo médio ponderado considerando apenas compras ATÉ a data da venda
            const avgCost = await calculateDailyAverageCost(record.product_id, saleDate);
            if (avgCost !== null) {
                // Preenche o campo com o valor calculado
                setEditingSaleCost((prev) => ({ ...prev, [index]: avgCost.toFixed(2) }));
                // Salva automaticamente no banco
                await updateSaleCostPerKg(String(record.id), avgCost);
                // Atualiza o registro local
                if (output) {
                    const updated = { ...output };
                    const idx = updated.records.findIndex(rec => rec.id === record.id);
                    if (idx !== -1) {
                        updated.records[idx] = { ...updated.records[idx], sale_cost_per_kg: avgCost };
                        setOutput(updated);
                    }
                }
            }
            else {
                setError(`Nenhuma compra encontrada para este produto até ${formatDateBR(saleDate)}`);
            }
        }
        catch (err) {
            console.error('Error calculating daily average:', err);
            setError(String(err?.message ?? 'Erro ao calcular média diária'));
        }
        finally {
            setCalculatingAverage((prev) => ({ ...prev, [index]: false }));
        }
    }
    async function onSaveSaleCost(record, index) {
        if (!record.id)
            return;
        const costStr = editingSaleCost[index];
        if (!costStr)
            return;
        const cost = Number(costStr.replace(',', '.'));
        if (isNaN(cost)) {
            setError('Valor inválido');
            return;
        }
        setLoading(true);
        try {
            await updateSaleCostPerKg(String(record.id), cost);
            const res = await fetchRecords();
            setOutput(res);
            setEditingSaleCost((prev) => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }
        catch (err) {
            setError(String(err?.message ?? 'Erro ao salvar custo de venda'));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "min-h-screen", children: [_jsxs("div", { className: "relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-400", children: [_jsx("div", { className: "absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNGgxMXYxMUgzNnpNMTEgMTM0aDExdjExSDExeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" }), _jsx("div", { className: "relative mx-auto max-w-7xl px-6 py-16", children: _jsxs("div", { className: "animate-fade-in", children: [_jsxs("h1", { className: "text-5xl font-bold text-white drop-shadow-lg", children: ["\uD83D\uDCCA Sistema de Gest\u00E3o ", _jsx("span", { className: "text-cyan-200", children: "NFe" })] }), _jsx("p", { className: "mt-4 text-lg text-white/90 max-w-2xl", children: "Gerencie suas notas fiscais com eleg\u00E2ncia. Importe, visualize e analise dados de compra e venda em tempo real." })] }) })] }), _jsxs("div", { className: "mx-auto max-w-7xl px-6 py-8", children: [_jsxs("div", { className: "animate-slide-in grid gap-6 lg:grid-cols-2 mb-8", children: [_jsxs("div", { className: "card-premium p-6", children: [_jsx("h3", { className: "text-lg font-semibold gradient-text mb-4", children: "\uD83D\uDE80 A\u00E7\u00F5es R\u00E1pidas" }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("button", { onClick: () => onLoadSupabase(), className: "btn-gradient flex items-center gap-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" }) }), "Carregar Dados"] }), _jsxs("label", { className: "btn-gradient cursor-pointer flex items-center gap-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }), "Upload Excel", _jsx("input", { type: "file", accept: ".xlsx,.xls", onChange: onFileChange, className: "hidden" })] }), _jsx("button", { onClick: onSendToN8n, className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5", children: "\uD83D\uDCE4 Enviar para n8n" })] }), loading && (_jsxs("div", { className: "mt-4 flex items-center gap-2 text-blue-600", children: [_jsx("div", { className: "w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm font-medium", children: "Processando..." })] })), error && (_jsx("div", { className: "mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700", children: error }))] }), _jsxs("div", { className: "card-premium p-6", children: [_jsx("h3", { className: "text-lg font-semibold gradient-text mb-4", children: "\uD83C\uDFAF Filtros" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Tipo de Nota" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${noteType === 'purchase'
                                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setNoteType('purchase'), children: "\uD83D\uDCE5 Entrada" }), _jsx("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${noteType === 'sale'
                                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setNoteType('sale'), children: "\uD83D\uDCE4 Sa\u00EDda" }), _jsx("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${noteType === ''
                                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setNoteType(''), children: "\uD83D\uDD04 Auto" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Visualizar" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${view === 'all'
                                                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setView('all'), children: ["Todos (", records.length, ")"] }), _jsxs("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${view === 'purchase'
                                                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setView('purchase'), children: ["Entradas (", countPurchase, ")"] }), _jsxs("button", { className: `flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${view === 'sale'
                                                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, onClick: () => setView('sale'), children: ["Sa\u00EDdas (", countSale, ")"] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\uD83D\uDCC5 Filtrar por Data" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "date", className: "flex-1 px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-medium text-sm", value: selectedDate, onChange: (e) => onDateChange(e.target.value) }), selectedDate && (_jsx("button", { onClick: () => { setSelectedDate(''); onLoadSupabase(''); }, className: "px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm transition-all", title: "Limpar filtro de data", children: "\u2715 Limpar" }))] }), selectedDate && (_jsxs("p", { className: "mt-2 text-xs text-gray-500", children: ["Mostrando apenas notas do dia: ", _jsx("strong", { children: formatDateBR(selectedDate) })] }))] }), !selectedDate && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\uD83D\uDCC6 Filtrar por M\u00EAs" }), _jsxs("select", { className: "w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-medium text-sm", value: selectedMonth, onChange: (e) => setSelectedMonth(e.target.value), children: [_jsxs("option", { value: "all", children: ["Todos os meses (", records.length, ")"] }), availableMonths.map(m => (_jsx("option", { value: m.value, children: m.label }, m.value)))] })] }))] })] }), _jsxs("div", { className: "card-premium p-6 lg:col-span-2", children: [_jsx("h3", { className: "text-lg font-semibold gradient-text mb-4", children: "\u2795 Novo Produto" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "text", className: "flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", placeholder: "Digite o nome do produto...", value: newProductName, onChange: (e) => setNewProductName(e.target.value) }), _jsx("button", { onClick: onInsertProduct, disabled: addingProduct, className: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed", children: addingProduct ? '...' : 'Adicionar' })] }), productMsg && (_jsx("p", { className: `mt-3 text-sm font-medium ${productMsg.includes('adicionado') ? 'text-green-600' : 'text-orange-600'}`, children: productMsg }))] })] }), records.length > 0 && (_jsxs("div", { className: "mt-8 grid grid-cols-1 gap-8", children: [(view === 'purchase' || view === 'all') && filteredRecords.filter(r => r.invoice_type === 'purchase').length > 0 && (_jsxs("section", { className: "card-premium p-6 animate-fade-in", children: [_jsxs("div", { className: "flex items-center gap-3 mb-5", children: [_jsx("div", { className: "w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xl", children: "\uD83D\uDCE5" }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-800", children: "Notas de Entrada" }), _jsx("p", { className: "text-sm text-gray-500", children: "Compras e aquisi\u00E7\u00F5es" })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white", children: [_jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Chave NFe" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Data" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Produto" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Qtd (kg)" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Valor Total" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Custo M\u00E9dio/kg" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: filteredRecords.filter(r => r.invoice_type === 'purchase').map((r) => {
                                                        const originalIndex = records.indexOf(r);
                                                        return (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50 transition-colors", children: [_jsx("td", { className: "px-3 py-3 text-gray-600 text-xs font-mono", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { title: r.chave_nfe ?? undefined, className: "truncate max-w-[120px]", children: formatChaveNfe(r.chave_nfe) }), r.chave_nfe && (_jsx("button", { onClick: () => {
                                                                                    navigator.clipboard.writeText(r.chave_nfe);
                                                                                    const btn = document.activeElement;
                                                                                    btn.textContent = '✓';
                                                                                    setTimeout(() => btn.textContent = '📋', 1000);
                                                                                }, className: "text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-blue-50", title: "Copiar chave", children: "\uD83D\uDCCB" }))] }) }), _jsx("td", { className: "px-3 py-3 text-gray-600", children: formatDateBR(r.invoice_date) }), _jsx("td", { className: "px-3 py-3", children: _jsxs("select", { className: "w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", value: rowOverrides[originalIndex]?.product ?? r.product ?? '', onChange: (e) => setRowProduct(originalIndex, e.target.value), children: [_jsx("option", { value: "", children: "Selecionar" }), products.map((p) => (_jsx("option", { value: p.nome, children: p.nome }, String(p.id))))] }) }), _jsx("td", { className: "px-3 py-3", children: _jsx("input", { type: "text", className: "w-24 rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", value: rowOverrides[originalIndex]?.quantity_kg ?? (typeof r.quantity_kg === 'number' ? String(r.quantity_kg) : ''), onChange: (e) => setRowQuantity(originalIndex, e.target.value) }) }), _jsx("td", { className: "px-3 py-3 font-semibold text-gray-900", children: formatCurrencyBR(r.total_value) }), _jsx("td", { className: "px-3 py-3", children: (() => {
                                                                        const accCost = r.id ? accumulatedAverageCosts[String(r.id)] : null;
                                                                        return accCost ? (_jsx("span", { className: "inline-block px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full text-xs font-medium", title: "Custo m\u00E9dio ponderado acumulado", children: formatCurrencyBR(accCost) })) : (_jsx("span", { className: "inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium", children: "-" }));
                                                                    })() }), _jsx("td", { className: "px-3 py-3", children: _jsx("button", { onClick: async () => {
                                                                            if (!r.id)
                                                                                return;
                                                                            if (!confirm('Tem certeza que deseja excluir esta nota?'))
                                                                                return;
                                                                            setDeleting((prev) => ({ ...prev, [String(r.id)]: true }));
                                                                            try {
                                                                                await deleteNfe(String(r.id));
                                                                                const res = await fetchRecords();
                                                                                setOutput(res);
                                                                            }
                                                                            catch (err) {
                                                                                setError(String(err?.message ?? 'Erro ao excluir'));
                                                                            }
                                                                            finally {
                                                                                setDeleting((prev) => ({ ...prev, [String(r.id)]: false }));
                                                                            }
                                                                        }, disabled: deleting[String(r.id)], className: "bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50", title: "Excluir nota", children: deleting[String(r.id)] ? '⏳' : '🗑️ Excluir' }) })] }, String(r.id)));
                                                    }) })] }) })] })), (view === 'sale' || view === 'all') && filteredRecords.filter(r => r.invoice_type === 'sale').length > 0 && (_jsxs("section", { className: "card-premium p-6 animate-fade-in", children: [_jsxs("div", { className: "flex items-center gap-3 mb-5", children: [_jsx("div", { className: "w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white text-xl", children: "\uD83D\uDCE4" }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-800", children: "Notas de Sa\u00EDda" }), _jsx("p", { className: "text-sm text-gray-500", children: "Vendas e transfer\u00EAncias" })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white", children: [_jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Chave NFe" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Data" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Produto" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Qtd (kg)" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Valor Total" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Custo M\u00E9dio/kg" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Saldo Ap\u00F3s (kg)" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "Valor Estoque" }), _jsx("th", { className: "px-3 py-3 text-left font-semibold", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: filteredRecords.filter(r => r.invoice_type === 'sale').map((r) => {
                                                        const originalIndex = records.indexOf(r);
                                                        const isCalculating = calculatingAverage[originalIndex] ?? false;
                                                        const needsCost = !r.sale_cost_per_kg && !editingSaleCost[originalIndex];
                                                        const balance = r.id ? stockBalances.get(String(r.id)) : null;
                                                        return (_jsxs("tr", { className: `border-b border-gray-100 hover:bg-gray-50 transition-colors ${needsCost ? 'bg-amber-50' : ''}`, children: [_jsx("td", { className: "px-3 py-3 text-gray-600 text-xs font-mono", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { title: r.chave_nfe ?? undefined, className: "truncate max-w-[120px]", children: formatChaveNfe(r.chave_nfe) }), r.chave_nfe && (_jsx("button", { onClick: () => {
                                                                                    navigator.clipboard.writeText(r.chave_nfe);
                                                                                    const btn = document.activeElement;
                                                                                    btn.textContent = '✓';
                                                                                    setTimeout(() => btn.textContent = '📋', 1000);
                                                                                }, className: "text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-blue-50", title: "Copiar chave", children: "\uD83D\uDCCB" }))] }) }), _jsx("td", { className: "px-3 py-3 text-gray-600", children: formatDateBR(r.invoice_date) }), _jsx("td", { className: "px-3 py-3", children: _jsxs("select", { className: "w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", value: rowOverrides[originalIndex]?.product ?? r.product ?? '', onChange: (e) => setRowProduct(originalIndex, e.target.value), children: [_jsx("option", { value: "", children: "Selecionar" }), products.map((p) => (_jsx("option", { value: p.nome, children: p.nome }, String(p.id))))] }) }), _jsx("td", { className: "px-3 py-3", children: _jsx("input", { type: "text", className: "w-24 rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", value: rowOverrides[originalIndex]?.quantity_kg ?? (typeof r.quantity_kg === 'number' ? String(r.quantity_kg) : ''), onChange: (e) => setRowQuantity(originalIndex, e.target.value) }) }), _jsx("td", { className: "px-3 py-3 font-semibold text-gray-900", children: formatCurrencyBR(r.total_value) }), _jsx("td", { className: "px-3 py-3", children: _jsx("input", { type: "text", className: "w-24 rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all", placeholder: balance?.averageCost ? balance.averageCost.toFixed(2) : '0.00', value: editingSaleCost[originalIndex] ?? (r.sale_cost_per_kg ? String(r.sale_cost_per_kg) : ''), onChange: (e) => setEditingSaleCost((prev) => ({ ...prev, [originalIndex]: e.target.value })), onBlur: () => {
                                                                            const costStr = editingSaleCost[originalIndex];
                                                                            if (costStr !== undefined && costStr !== '' && r.id) {
                                                                                const cost = Number(costStr.replace(',', '.'));
                                                                                if (!isNaN(cost)) {
                                                                                    updateSaleCostPerKg(String(r.id), cost).then(() => {
                                                                                        // Atualiza o registro local
                                                                                        if (output) {
                                                                                            const updated = { ...output };
                                                                                            const idx = updated.records.findIndex(rec => rec.id === r.id);
                                                                                            if (idx !== -1) {
                                                                                                updated.records[idx] = { ...updated.records[idx], sale_cost_per_kg: cost };
                                                                                                setOutput(updated);
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }, title: "Digite o custo m\u00E9dio em R$/kg" }) }), _jsx("td", { className: "px-3 py-3", children: balance ? (_jsxs("span", { className: `inline-block px-3 py-1 rounded-full text-xs font-medium ${balance.balanceKg < 0
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : balance.balanceKg === 0
                                                                                ? 'bg-gray-100 text-gray-600'
                                                                                : 'bg-blue-100 text-blue-700'}`, title: `Entradas: ${balance.totalEntries} kg | Saídas: ${balance.totalExits} kg`, children: [balance.balanceKg.toLocaleString('pt-BR', { minimumFractionDigits: 1 }), " kg"] })) : (_jsx("span", { className: "inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs", children: "-" })) }), _jsx("td", { className: "px-3 py-3", children: balance ? (_jsx("span", { className: `inline-block px-3 py-1 rounded-full text-xs font-medium ${balance.stockValue < 0
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-green-100 text-green-700'}`, children: formatCurrencyBR(balance.stockValue) })) : (_jsx("span", { className: "inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs", children: "-" })) }), _jsx("td", { className: "px-3 py-2", children: _jsx("button", { onClick: () => onCalculateAverage(r, originalIndex), disabled: isCalculating || !r.product_id, className: "bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed", title: "Preencher com custo m\u00E9dio ponderado das entradas at\u00E9 esta data", children: isCalculating ? '⏳' : '🔢 Auto' }) })] }, String(r.id)));
                                                    }) })] }) })] })), _jsxs("section", { className: "card-premium p-6 animate-fade-in", children: [_jsxs("div", { className: "flex items-center gap-3 mb-5", children: [_jsx("div", { className: "w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-xl", children: "\uD83D\uDCC4" }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-800", children: "Dados JSON" }), _jsx("p", { className: "text-sm text-gray-500", children: "Visualiza\u00E7\u00E3o t\u00E9cnica dos dados normalizados" })] })] }), _jsxs("details", { className: "group", children: [_jsxs("summary", { className: "cursor-pointer select-none py-2 px-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg font-medium text-purple-700 hover:from-purple-100 hover:to-pink-100 transition-all", children: [_jsx("span", { className: "group-open:rotate-90 inline-block transition-transform", children: "\u25B6" }), " Clique para expandir JSON"] }), _jsx("pre", { className: "mt-4 whitespace-pre-wrap rounded-lg border-2 border-purple-200 bg-gradient-to-br from-gray-50 to-purple-50 p-4 text-xs font-mono overflow-x-auto", children: JSON.stringify(effectiveOutput, null, 2) })] })] })] }))] })] }));
}
