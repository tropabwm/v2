// pages/api/dashboard.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, differenceInDays } from 'date-fns';
import mysql from 'mysql2/promise';

interface AggregatedMetrics {
    totalRevenue: number;
    totalClicks: number;
    totalSales: number;
    totalCost: number;
    totalImpressions: number;
    totalBudgetSum: number; // Renamed from totalBudget to totalBudgetSum for clarity w/ campaigns table aggregation
}

interface CalculatedMetrics extends AggregatedMetrics {
    ctr: number | null;
    cpc: number | null;
    conversionRate: number | null;
    costPerConversion: number | null;
    roi: number | null;
    useBudget: number | null;
    budgetRemaining: number | null;
    realProfit: number;
    realProfitMargin: number | null;
}

interface DailyDataPoint {
    date: string;
    revenue: number;
    clicks: number;
    impressions?: number;
    conversions?: number;
    cost?: number;
}

interface DashboardApiResponse {
    totals: CalculatedMetrics;
    dailyData: DailyDataPoint[];
    totalUsers?: number; // Optional, depending on DB schema
    userChange?: number | null; // Optional, depending on DB schema
    revenueChange?: number | null;
    clickChange?: number | null;
    salesChange?: number | null;
    conversionRateChange?: number | null;
    useBudgetChange?: number | null;
    roiChange?: number | null;
    profitChange?: number | null;
    budgetRemainingChange?: number | null;
}

const calculateChange = (current: number | null | undefined, previous: number | null | undefined): number | null => {
    const currentNum = Number(current ?? 0);
    const previousNum = Number(previous ?? 0);
    if (previousNum === 0) {
         if (currentNum === 0) return 0; // No change if both are zero
         return null; // Infinite growth from zero
    }
    // Use a small epsilon to avoid division by near-zero
    if (Math.abs(previousNum) < 1e-9) {
         return currentNum === 0 ? 0 : null;
    }
    const change = ((currentNum - previousNum) / previousNum) * 100;
    if (!isFinite(change)) return null;
    return parseFloat(change.toFixed(1));
};

async function getAggregatedData(
    connection: mysql.PoolConnection,
    startDate: string,
    endDate: string,
    campaignId: string | null // campaignId is string (UUID) or null
): Promise<AggregatedMetrics> {
    // REMOVIDO: Comentário '-- CORRIGIDO: Usando d.date' dentro da string SQL
    let sql = `
        SELECT
            COALESCE(SUM(d.revenue), 0) AS totalRevenue,
            COALESCE(SUM(d.clicks), 0) AS totalClicks,
            COALESCE(SUM(d.conversions), 0) AS totalSales,
            COALESCE(SUM(d.cost), 0) AS totalCost,
            COALESCE(SUM(d.impressions), 0) AS totalImpressions,
            (
                SELECT COALESCE(SUM(budget), 0)
                FROM campaigns
                WHERE (? IS NULL OR id = ?)
            ) AS totalBudgetSum
        FROM daily_metrics d
        WHERE d.date BETWEEN ? AND ?
    `;
     const params: (string | number | null)[] = [campaignId, campaignId, startDate, endDate];
    if (campaignId !== null) {
        sql += ' AND d.campaign_id = ?';
        params.push(campaignId);
    }
    console.log("[API DB Query Agg]", connection.format(sql, params));
    const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);
    const result = rows[0] || { totalRevenue: 0, totalClicks: 0, totalSales: 0, totalCost: 0, totalImpressions: 0, totalBudgetSum: 0 };
    return {
        totalRevenue: Number(result.totalRevenue),
        totalClicks: Number(result.totalClicks),
        totalSales: Number(result.totalSales),
        totalCost: Number(result.totalCost),
        totalImpressions: Number(result.totalImpressions),
        totalBudgetSum: Number(result.totalBudgetSum) // Return as totalBudgetSum
    };
}

async function getDailyData(
    connection: mysql.PoolConnection,
    startDate: string,
    endDate: string,
    campaignId: string | null // campaignId is string (UUID) or null
): Promise<DailyDataPoint[]> {
    // REMOVIDO: Comentário '-- CORRIGIDO: Usando date' dentro da string SQL
    let sql = `
        SELECT
            DATE_FORMAT(date, '%Y-%m-%d') AS date, -- Using date
            COALESCE(SUM(revenue), 0) AS revenue,
            COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(impressions), 0) AS impressions,
            COALESCE(SUM(conversions), 0) AS conversions,
            COALESCE(SUM(cost), 0) AS cost
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
    `;
    const params: (string | null)[] = [startDate, endDate]; // Type of params
    if (campaignId !== null) {
        sql += ' AND campaign_id = ?';
        params.push(campaignId);
    }
    sql += ' GROUP BY date ORDER BY date ASC'; // Group and order by the actual date column alias
    console.log("[API DB Query Daily]", connection.format(sql, params));
    const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);
    return rows.map(row => ({
        date: row.date,
        revenue: Number(row.revenue),
        clicks: Number(row.clicks),
        impressions: Number(row.impressions),
        conversions: Number(row.conversions),
        cost: Number(row.cost)
    }));
}

function calculateDerivedMetrics(data: AggregatedMetrics): CalculatedMetrics {
    const { totalClicks, totalImpressions, totalSales, totalCost, totalRevenue, totalBudgetSum } = data; // Use totalBudgetSum
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : null;
    const conversionRate = totalClicks > 0 ? (totalSales / totalClicks) * 100 : null;
    const costPerConversion = totalSales > 0 ? totalCost / totalSales : null;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : (totalRevenue > 0 ? Infinity : (totalRevenue === 0 ? 0 : null));
    // Calculation for useBudget and budgetRemaining uses totalBudgetSum
    const useBudget = totalBudgetSum !== undefined && totalBudgetSum !== null && totalBudgetSum > 0 ? (totalCost / totalBudgetSum) * 100 : (totalBudgetSum === 0 ? 0 : null);
    const budgetRemaining = totalBudgetSum !== undefined && totalBudgetSum !== null ? totalBudgetSum - totalCost : null;
    const realProfit = totalRevenue - totalCost;
    const realProfitMargin = totalRevenue > 0 ? (realProfit / totalRevenue) * 100 : (totalRevenue === 0 ? 0 : null);
    const safeMetric = (value: number | null | undefined): number | null => {
        if (value === null || value === undefined || !isFinite(value)) return null;
        return parseFloat(value.toFixed(2));
    };
    return {
        totalRevenue, totalClicks, totalSales, totalCost, totalImpressions, totalBudgetSum, // Include totalBudgetSum
        ctr: safeMetric(ctr),
        cpc: safeMetric(cpc),
        conversionRate: safeMetric(conversionRate),
        costPerConversion: safeMetric(costPerConversion),
        roi: safeMetric(roi),
        useBudget: safeMetric(useBudget),
        budgetRemaining: budgetRemaining !== null ? parseFloat(budgetRemaining.toFixed(2)) : null,
        realProfit: parseFloat(realProfit.toFixed(2)),
        realProfitMargin: safeMetric(realProfitMargin),
    };
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<DashboardApiResponse | { error: string; details?: string; }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { startDate: startDateStr, endDate: endDateStr, campaignId: campaignIdStr } = req.query;
    if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
        return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });
    }
    // Ensure dates are parsed correctly and include time for BETWEEN clause accuracy
    const start = startOfDay(parseISO(startDateStr));
    const end = endOfDay(parseISO(endDateStr));
    if (!isValid(start) || !isValid(end) || end < start) {
        return res.status(400).json({ error: 'Datas inválidas.' });
    }

    // Treat campaignId as string (UUID) or null
    const campaignId: string | null = (campaignIdStr && typeof campaignIdStr === 'string' && campaignIdStr.toLowerCase() !== 'all' && campaignIdStr !== '')
        ? campaignIdStr // Use the string value if not 'all' or empty
        : null; // Otherwise treat as null (all campaigns)

    // Optional: Add UUID validation for campaignId if it's not null
    // const isUuid = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    // if (campaignId !== null && !isUuid(campaignId)) {
    //     return res.status(400).json({ error: 'ID da campanha inválido.' });
    // }


    let connection: mysql.PoolConnection | null = null;
    try {
        const pool = getDbPool();
        connection = await pool.getConnection();
        // await initializeAllTables(); // Avoid running this on every API call in production

        const daysInPeriod = differenceInDays(end, start) + 1; // Include both start and end day
        const prevEndDate = subDays(start, 1);
        const prevStartDate = subDays(prevEndDate, daysInPeriod -1); // Adjust for differenceInDays

         const currentStartDateSql = format(start, 'yyyy-MM-dd HH:mm:ss');
         const currentEndDateSql = format(end, 'yyyy-MM-dd HH:mm:ss');
         const prevStartDateSql = format(startOfDay(prevStartDate), 'yyyy-MM-dd HH:mm:ss');
         const prevEndDateSql = format(endOfDay(prevEndDate), 'yyyy-MM-dd HH:mm:ss');


        const currentAggregated = await getAggregatedData(connection, currentStartDateSql, currentEndDateSql, campaignId);
        const currentDaily = await getDailyData(connection, currentStartDateSql, currentEndDateSql, campaignId);
        const currentCalculated = calculateDerivedMetrics(currentAggregated);

        const prevAggregated = await getAggregatedData(connection, prevStartDateSql, prevEndDateSql, campaignId);
        const prevCalculated = calculateDerivedMetrics(prevAggregated);

        const revenueChange = calculateChange(currentCalculated.totalRevenue, prevCalculated.totalRevenue);
        const clickChange = calculateChange(currentCalculated.totalClicks, prevCalculated.totalClicks);
        const salesChange = calculateChange(currentCalculated.totalSales, prevCalculated.totalSales);
        // Ensure we compare metric change only if both periods had values
        const conversionRateChange = calculateChange(currentCalculated.conversionRate, prevCalculated.conversionRate);
        const useBudgetChange = calculateChange(currentCalculated.useBudget, prevCalculated.useBudget);
        const roiChange = calculateChange(currentCalculated.roi, prevCalculated.roi);
        const profitChange = calculateChange(currentCalculated.realProfit, prevCalculated.realProfit);
        const budgetRemainingChange = calculateChange(currentCalculated.budgetRemaining, prevCalculated.budgetRemaining);

         // Handle user_id if it exists in daily_metrics.
         // Check column existence first to avoid SQL errors if schema doesn't match.
         let totalUsers = 0;
         let userChangeVal: number | null = null;
         try {
             // Use information_schema or SHOW COLUMNS, but SHOW COLUMNS is simpler here
             const [cols]: any = await connection.query(`SHOW COLUMNS FROM daily_metrics LIKE 'user_id'`);
             if (cols.length > 0) {
                 // If user_id column exists, perform user count query
                 const userCountQuery = `SELECT COUNT(DISTINCT user_id) as totalUsers FROM daily_metrics WHERE date BETWEEN ? AND ? ${campaignId !== null ? ' AND campaign_id = ?' : ''}`; // Using 'date' here also
                 const userCountParams: (string | null)[] = [currentStartDateSql, currentEndDateSql];
                 if (campaignId !== null) userCountParams.push(campaignId);
                 const [userRows]: any = await connection.query(userCountQuery, userCountParams);
                 totalUsers = userRows[0]?.totalUsers ? Number(userRows[0].totalUsers) : 0;

                 const prevUserCountParams: (string | null)[] = [prevStartDateSql, prevEndDateSql];
                 if (campaignId !== null) prevUserCountParams.push(campaignId);
                 const [prevUserRows]: any = await connection.query(userCountQuery, prevUserCountParams);
                 const prevTotalUsers = prevUserRows[0]?.totalUsers ? Number(prevUserRows[0].totalUsers) : 0;
                 userChangeVal = calculateChange(totalUsers, prevTotalUsers);
             } else {
                 // Log warning if column is missing, but don't fail the API
                 console.warn("[API Dashboard] Coluna 'user_id' não encontrada em 'daily_metrics'. totalUsers e userChange não serão calculados.");
             }
         } catch(dbError: any) {
             console.error("[API Dashboard] Erro ao verificar/contar user_id:", dbError);
             // Log the error but allow the rest of the API to proceed
             console.warn("[API Dashboard] totalUsers e userChange não serão calculados devido ao erro do DB.");
         }


        const responseData: DashboardApiResponse = {
            totals: currentCalculated,
            dailyData: currentDaily,
            totalUsers: totalUsers, // Will be 0 if user_id column is missing/error
            userChange: userChangeVal, // Will be null if user_id column is missing/error
            revenueChange: revenueChange,
            clickChange: clickChange,
            salesChange: salesChange,
            conversionRateChange: conversionRateChange,
            useBudgetChange: useBudgetChange,
            roiChange: roiChange,
            profitChange: profitChange,
            budgetRemainingChange: budgetRemainingChange,
        };
        console.log("[API /api/dashboard] Response Data:", JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
    } catch (error: any) {
        console.error('[API /api/dashboard] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard.', details: error.message });
    } finally {
        if (connection) connection.release();
    }
}
