// pages/api/daily-metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import { isValid, parseISO, format } from 'date-fns';

interface DailyMetricInput {
    campaign_id: string;
    date: string;
    clicks?: number;
    impressions?: number;
    conversions?: number;
    cost?: number;
    revenue?: number;
}

type PostResponse = {
    message: string;
    insertedId?: number | string;
    error?: string;
    code?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PostResponse>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed`, error: 'Only POST is allowed' });
    }

    let dbPool: mysql.Pool | null = null;
    try {
        dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Ensure tables exist, including daily_metrics with the 'date' column
        await initializeAllTables();

        const {
            campaign_id,
            date: dateStr, // Renomeado para evitar conflito com a variável 'date' do date-fns
            clicks,
            impressions,
            conversions,
            cost,
            revenue
        }: DailyMetricInput = req.body;

        if (!campaign_id || !dateStr) {
            return res.status(400).json({ message: "campaign_id e date são obrigatórios.", error: "Dados inválidos" });
        }
        const metricDate = parseISO(dateStr);
        if (!isValid(metricDate)) {
            return res.status(400).json({ message: "Formato de data inválido. Use YYYY-MM-DD.", error: "Data inválida" });
        }
        const metricDateSql = format(metricDate, 'yyyy-MM-dd');

        // CORREÇÃO: Usar 'date' em vez de 'metric_date' para corresponder ao schema esperado
        const sql = `
            INSERT INTO daily_metrics
                (campaign_id, date, clicks, impressions, conversions, cost, revenue)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                clicks = VALUES(clicks),
                impressions = VALUES(impressions),
                conversions = VALUES(conversions),
                cost = VALUES(cost),
                revenue = VALUES(revenue),
                updated_at = CURRENT_TIMESTAMP;
        `;

        const params = [
            campaign_id,
            metricDateSql,
            clicks ?? 0,
            impressions ?? 0,
            conversions ?? 0,
            cost ?? 0.00,
            revenue ?? 0.00
        ];

        console.log("[API DailyMetrics POST] SQL:", sql);
        console.log("[API DailyMetrics POST] Params:", params);

        const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);

        if (result.affectedRows > 0 || result.warningStatus === 0) {
             // For ON DUPLICATE KEY UPDATE, insertId might be 0 or a duplicate key value, affectedRows is more reliable
             const message = result.insertId > 0 ? "Métrica diária inserida com sucesso." : "Métrica diária atualizada com sucesso.";
             // Use affectedRows > 0 to determine success, insertId for new rows
             console.log(`[API DailyMetrics POST] ${message} (Affected Rows: ${result.affectedRows})`);
             res.status(result.insertId > 0 ? 201 : 200).json({ message: message, insertedId: result.insertId || `${campaign_id}/${metricDateSql}` });
        } else {
             // This case indicates the query executed but didn't affect any rows, might need investigation
             console.error("[API DailyMetrics POST] Query executada, mas nenhuma linha afetada.", result);
             res.status(500).json({ message: "Falha ao salvar métrica diária, verifique os dados.", error: "DB Operation Issue" });
        }

    } catch (error: any) {
        console.error(`[API DailyMetrics POST] Erro geral:`, error);
         const isFkError = error.code === 'ER_NO_REFERENCED_ROW_2';
         const status = isFkError ? 400 : 500;
         const message = isFkError ? `Campanha com ID ${req.body.campaign_id} não encontrada.` : 'Erro interno do servidor ao salvar métrica.';
        res.status(status).json({ message: message, error: error.message, code: error.code });
    }
}
