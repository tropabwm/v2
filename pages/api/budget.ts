// pages/api/budget.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Funções de formatação
const formatCurrency = (value: number): string => isNaN(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPercentage = (value: number): string => `${Number(value).toFixed(1)}%`;

// Estrutura para os dados do gráfico de pizza a serem enviados para o frontend
type PieChartDataItem = {
  name: string;  // Nome da fatia (ex: "Tráfego")
  value: number; // Valor da fatia
  color: string; // Cor da fatia
};

// Estrutura da resposta ATUALIZADA
type BudgetData = {
  totalBudget?: number; totalBudgetFmt?: string;
  totalRealCost?: number; totalRealCostFmt?: string;
  totalRevenue?: number; totalRevenueFmt?: string;
  realProfit?: number; realProfitFmt?: string;
  budgetUsedPerc?: number;
  budgetRemaining?: number; budgetRemainingFmt?: string;
  realProfitMargin?: number | null;
  trafficCost?: number; trafficCostFmt?: string; trafficPerc?: number;
  creativeCost?: number; creativeCostFmt?: string; creativePerc?: number;
  operationalCost?: number; operationalCostFmt?: string; opPerc?: number;
  unallocatedValue?: number; unallocatedFmt?: string; unallocatedPerc?: number;
  pieChartData?: PieChartDataItem[]; // <--- ALTERADO: Agora envia dados para o gráfico
  chartImageUrl?: string | null; // Mantido para possível fallback ou outro uso, mas o foco é pieChartData
};

// Cores para as fatias do gráfico (pode ser definido no frontend também)
const costColors = {
    traffic: '#3b82f6',    // Azul
    creative: '#22c55e',  // Verde
    operational: '#eab308', // Amarelo
    unallocated: '#6b7280' // Cinza
};


// Handler da API
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BudgetData | { message: string; error?: string; code?: string; }>
) {
  if (req.method === 'GET') {
    let dbPool: mysql.Pool | null = null;
    try {
        dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        await initializeAllTables();

        const { startDate: startDateStr, endDate: endDateStr, campaignId } = req.query;
        console.log(`[API /api/budget] GET Req:`, { startDate: startDateStr, endDate: endDateStr, campaignId });

        let start: Date | null = null; let end: Date | null = null;
        if (startDateStr && typeof startDateStr === 'string') start = startOfDay(parseISO(startDateStr));
        if (endDateStr && typeof endDateStr === 'string') end = endOfDay(parseISO(endDateStr));
        if ((start && !isValid(start)) || (end && !isValid(end)) || (start && end && end < start)) { start = null; end = null; }
        const startDateSql = start ? format(start, 'yyyy-MM-dd') : null;
        const endDateSql = end ? format(end, 'yyyy-MM-dd') : null;

        let campaignSql = `
            SELECT
                SUM(budget) as totalBudgetSum,
                SUM(cost_traffic) as totalTrafficCost,
                SUM(cost_creative) as totalCreativeCost,
                SUM(cost_operational) as totalOperationalCost
            FROM campaigns
            WHERE 1=1
        `;
        const campaignParams: string[] = [];
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') {
            campaignSql += ' AND id = ?';
            campaignParams.push(campaignId);
        }
        const [campaignRows] = await dbPool.query<mysql.RowDataPacket[]>(campaignSql, campaignParams);
        const totalBudget = Number(campaignRows[0]?.totalBudgetSum ?? 0);
        const trafficCost = Number(campaignRows[0]?.totalTrafficCost ?? 0);
        const creativeCost = Number(campaignRows[0]?.totalCreativeCost ?? 0);
        const operationalCost = Number(campaignRows[0]?.totalOperationalCost ?? 0);

        let metricsSql = `
            SELECT
                SUM(cost) as totalRealCostSum,
                SUM(revenue) as totalRevenueSum
            FROM daily_metrics
            WHERE 1=1
        `;
        const metricsParams: (string | null)[] = [];
        if (startDateSql && endDateSql) { metricsSql += ' AND metric_date BETWEEN ? AND ?'; metricsParams.push(startDateSql, endDateSql); }
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') { metricsSql += ' AND campaign_id = ?'; metricsParams.push(campaignId); }

        const [metricsRows] = await dbPool.query<mysql.RowDataPacket[]>(metricsSql, metricsParams);
        const totalRealCost = Number(metricsRows[0]?.totalRealCostSum ?? 0);
        const totalRevenue = Number(metricsRows[0]?.totalRevenueSum ?? 0);

        const realProfit = totalRevenue - totalRealCost;
        const allocatedCost = trafficCost + creativeCost + operationalCost;
        const unallocatedValue = totalBudget - allocatedCost;
        const budgetUsedPerc = totalBudget > 0 ? (totalRealCost / totalBudget) * 100 : 0;
        const budgetRemaining = totalBudget - totalRealCost;
        const realProfitMargin = totalRevenue > 0 ? (realProfit / totalRevenue) * 100 : 0;
        const trafficPerc = totalBudget > 0 ? (trafficCost / totalBudget) * 100 : 0;
        const creativePerc = totalBudget > 0 ? (creativeCost / totalBudget) * 100 : 0;
        const opPerc = totalBudget > 0 ? (operationalCost / totalBudget) * 100 : 0;
        const unallocatedPerc = totalBudget > 0 ? (unallocatedValue / totalBudget) * 100 : (totalBudget === 0 ? 100 : 0);

        // --- PREPARAR DADOS PARA O GRÁFICO DE PIZZA (RECHARTS) ---
        const pieChartData: PieChartDataItem[] = [];
        if (trafficCost > 0) pieChartData.push({ name: 'Tráfego', value: trafficCost, color: costColors.traffic });
        if (creativeCost > 0) pieChartData.push({ name: 'Criativos', value: creativeCost, color: costColors.creative });
        if (operationalCost > 0) pieChartData.push({ name: 'Operacional', value: operationalCost, color: costColors.operational });
        if (unallocatedValue > 0) pieChartData.push({ name: 'Não Alocado', value: unallocatedValue, color: costColors.unallocated });


        const responseData: BudgetData = {
            totalBudget: totalBudget, totalBudgetFmt: formatCurrency(totalBudget),
            trafficCost: trafficCost, trafficCostFmt: formatCurrency(trafficCost), trafficPerc: parseFloat(trafficPerc.toFixed(1)),
            creativeCost: creativeCost, creativeCostFmt: formatCurrency(creativeCost), creativePerc: parseFloat(creativePerc.toFixed(1)),
            operationalCost: operationalCost, operationalCostFmt: formatCurrency(operationalCost), opPerc: parseFloat(opPerc.toFixed(1)),
            unallocatedValue: unallocatedValue, unallocatedFmt: formatCurrency(unallocatedValue), unallocatedPerc: parseFloat(unallocatedPerc.toFixed(1)),
            totalRevenue: totalRevenue, totalRevenueFmt: formatCurrency(totalRevenue),
            totalRealCost: totalRealCost, totalRealCostFmt: formatCurrency(totalRealCost),
            realProfit: realProfit, realProfitFmt: formatCurrency(realProfit),
            realProfitMargin: isFinite(realProfitMargin) ? parseFloat(realProfitMargin.toFixed(1)) : null,
            budgetUsedPerc: parseFloat(budgetUsedPerc.toFixed(1)),
            budgetRemaining: budgetRemaining, budgetRemainingFmt: formatCurrency(budgetRemaining),
            pieChartData: pieChartData.length > 0 ? pieChartData : undefined, // Enviar apenas se houver dados
            chartImageUrl: null, // Não vamos mais gerar a URL da imagem aqui
        };

        res.status(200).json(responseData);

    } catch (error: any) {
      console.error("[API /api/budget] Erro:", error);
      res.status(500).json({ message: `Erro Interno: ${error.message || 'Erro desconhecido'}`, error: error.message, code: error.code });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Método ${req.method} Não Permitido` });
  }
}
