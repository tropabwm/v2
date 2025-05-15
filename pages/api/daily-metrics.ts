// pages/api/daily-metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import { isValid, parseISO, format } from 'date-fns';

interface DailyMetricInput {
    campaign_id: string;
    date: string; // Recebe 'date' do frontend
    user_id?: number | null; 
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

        // Considere o impacto de performance desta chamada em cada request
        // await initializeAllTables(); 

        const {
            campaign_id,
            date: dateStr,
            user_id,
            clicks,
            impressions,
            conversions,
            cost,
            revenue
        }: DailyMetricInput = req.body;

        if (!campaign_id || !dateStr) {
            return res.status(400).json({ message: "campaign_id e date são obrigatórios.", error: "Dados inválidos" });
        }
        const parsedDate = parseISO(dateStr);
        if (!isValid(parsedDate)) {
            return res.status(400).json({ message: "Formato de data inválido. Use YYYY-MM-DD.", error: "Data inválida" });
        }
        const metricDateSql = format(parsedDate, 'yyyy-MM-dd');

        const sql = `
            INSERT INTO daily_metrics
                (campaign_id, user_id, metric_date, clicks, impressions, conversions, cost, revenue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            user_id ?? null,
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
        
        // affectedRows: 1 for a new row, 2 for an update (1 delete + 1 insert effectively by ON DUPLICATE KEY UPDATE)
        // insertId will be the new auto_increment ID for new rows, or 0 if no new row was inserted (or last_insert_id if updated)
        if (result.affectedRows > 0) {
             const wasInsert = result.insertId > 0 && result.affectedRows === 1;
             const message = wasInsert ? "Métrica diária inserida com sucesso." : "Métrica diária atualizada com sucesso.";
             
             console.log(`[API DailyMetrics POST] ${message} (Affected Rows: ${result.affectedRows}, Insert ID: ${result.insertId})`);
             res.status(wasInsert ? 201 : 200).json({ 
                 message: message, 
                 insertedId: result.insertId > 0 ? result.insertId : `${campaign_id}/${user_id ?? 'null'}/${metricDateSql}`
             });
        } else if (result.affectedRows === 0 && result.warningStatus === 0) {
            // This means the key existed but all updated values were identical to existing ones.
            console.log(`[API DailyMetrics POST] Nenhuma alteração nos dados da métrica diária. (Affected Rows: 0)`);
            res.status(200).json({ 
                message: "Nenhuma alteração nos dados da métrica diária, valores idênticos aos existentes.",
                insertedId: `${campaign_id}/${user_id ?? 'null'}/${metricDateSql}`
            });
        }
        else {
             console.error("[API DailyMetrics POST] Query executada, mas com resultado inesperado.", result);
             res.status(500).json({ message: "Falha ao salvar métrica diária, resultado inesperado do DB.", error: "DB Operation Issue" });
        }

    } catch (error: any) {
        console.error(`[API DailyMetrics POST] Erro geral:`, error);
         const isFkErrorUser = error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('fk_dm_user_id');
         const isFkErrorCampaign = error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('fk_dm_campaign_id');
         
         let status = 500;
         let message = 'Erro interno do servidor ao salvar métrica.';

         if (isFkErrorUser) {
            status = 400;
            message = `Usuário com ID ${req.body.user_id} não encontrado.`;
         } else if (isFkErrorCampaign) {
            status = 400;
            message = `Campanha com ID ${req.body.campaign_id} não encontrada.`;
         }

        res.status(status).json({ message: message, error: error.message, code: error.code });
    }
}
