// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql'; // Garanta que este caminho está correto e exporta getDbPool
import mysql from 'mysql2/promise';
import crypto from 'crypto';
// Supondo que você tenha um verifyToken para autenticação
// import { verifyToken } from '@/lib/auth'; 

// --- Interfaces Atualizadas ---
interface CampaignInput {
    name?: string;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    selectedClientAccountId?: string | null; // ID interno da conta de cliente vinculada
    // external_platform_account_id?: string | null; // ID da conta na plataforma (Google, Meta) - pode vir com selectedClientAccountId
    // platform_source?: 'google' | 'meta' | 'tiktok' | 'manual' | string | null; // Plataforma da conta vinculada
    
    platform?: string[] | null; // Plataformas da campanha (pode ser diferente da plataforma da conta vinculada)
    objective?: string[] | null;
    ad_format?: string[] | null;
    
    budget?: number | string | null;
    daily_budget?: number | string | null;
    start_date?: string | null; // Espera string ISO ou formatada que Date() entenda
    end_date?: string | null;

    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null;
    avg_ticket?: number | string | null;
    
    user_id?: number | null; // ID do usuário/agência do USB MKT PRO

    // Campos camelCase que podem vir do frontend e precisam ser mapeados
    selectedclientaccountid?: string | null;
    dailyBudget?: number | string | null;
    startDate?: string | null;
    endDate?: string | null;
    targetAudienceDescription?: string | null;
    avgTicket?: number | string | null;
    // Adicione outros campos camelCase conforme necessário
}

interface CampaignDbRecord {
    id: string;
    user_id: number; // Não nulo no DB, associado ao criador/agência
    name: string;
    status: string;
    selected_client_account_id?: string | null;
    // external_platform_account_id?: string | null; 
    // platform_source?: string | null;

    platforms?: string | null; // JSON array de strings
    objectives?: string | null; // JSON array de strings
    ad_formats?: string | null; // JSON array de strings

    budget?: number | null;
    daily_budget?: number | null;
    start_date?: string | null; // YYYY-MM-DD
    end_date?: string | null;   // YYYY-MM-DD

    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null;
    avg_ticket?: number | null;
    
    external_campaign_id?: string | null; // ID da campanha na plataforma de anúncios
    created_at: string;
    updated_at: string;
}

interface CampaignResponse extends Omit<CampaignDbRecord, 'platforms' | 'objectives' | 'ad_formats' | 'user_id'> {
    user_id?: number | null; // Pode ser opcional na resposta dependendo do caso de uso
    platforms?: string[] | null;
    objectives?: string[] | null;
    ad_formats?: string[] | null;
    // Mapear snake_case para camelCase se o frontend preferir
    selectedClientAccountId?: string | null;
    dailyBudget?: number | null;
    startDate?: string | null; // ISO string
    endDate?: string | null;   // ISO string
    targetAudienceDescription?: string | null;
    avgTicket?: number | null;
}

const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; user_id?: any; name?: any; status?: any; selected_client_account_id?: any;
    platforms?: any; objectives?: any; ad_formats?: any; budget?: any; daily_budget?: any;
    start_date?: any; end_date?: any; target_audience_description?: any; industry?: any;
    segmentation_notes?: any; avg_ticket?: any; external_campaign_id?: any; created_at?: any; updated_at?: any;
}
const campaignDbSchemaKeys = Object.keys(new CampaignDbRecordExample());

const mapInputToDbFields = (input: CampaignInput): Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> => {
    const dbFields: Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {};
    const inputProcessed = { ...input };

    const camelToSnakeMapping: { [key: string]: keyof CampaignDbRecord } = {
        selectedClientAccountId: 'selected_client_account_id',
        dailyBudget: 'daily_budget',
        startDate: 'start_date',
        endDate: 'end_date',
        targetAudienceDescription: 'target_audience_description',
        avgTicket: 'avg_ticket',
    };

    for (const camelKey in camelToSnakeMapping) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, camelKey)) {
            const snakeKey = camelToSnakeMapping[camelKey as keyof typeof camelToSnakeMapping];
            (dbFields as any)[snakeKey] = (inputProcessed as any)[camelKey];
            delete (inputProcessed as any)[camelKey];
        }
    }
    
    for (const key in inputProcessed) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, key)) {
            const value = (inputProcessed as any)[key];
            const snakeKey = toSnakeCase(key) as keyof CampaignDbRecord;

            if (campaignDbSchemaKeys.includes(snakeKey)) {
                if (['platforms', 'objectives', 'ad_formats'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = Array.isArray(value) && value.length > 0 ? JSON.stringify(value) : null;
                } else if (['start_date', 'end_date'].includes(snakeKey) && value) {
                    try {
                        (dbFields as any)[snakeKey] = new Date(value as string).toISOString().slice(0, 10);
                    } catch { (dbFields as any)[snakeKey] = null; }
                } else if (['budget', 'daily_budget', 'avg_ticket'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = (value !== null && value !== undefined && String(value).trim() !== "") ? Number(value) : null;
                } else if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
                     (dbFields as any)[snakeKey] = null;
                }
                else {
                    (dbFields as any)[snakeKey] = value;
                }
            }
        }
    }
    return dbFields;
};

const parseDbRecordToResponse = (dbRecord: CampaignDbRecord): CampaignResponse => {
    const { 
        platforms: dbPlatforms, 
        objectives: dbObjectives, 
        ad_formats: dbAdFormats,
        selected_client_account_id,
        daily_budget,
        start_date,
        end_date,
        target_audience_description,
        avg_ticket,
        ...restOfDbRecord 
    } = dbRecord;

    const response: CampaignResponse = {
        ...restOfDbRecord,
        platforms: dbPlatforms ? JSON.parse(dbPlatforms) : null,
        objectives: dbObjectives ? JSON.parse(dbObjectives) : null,
        ad_formats: dbAdFormats ? JSON.parse(dbAdFormats) : null,
        selectedClientAccountId: selected_client_account_id, // Mapeia para camelCase
        dailyBudget: daily_budget,
        startDate: start_date ? new Date(start_date).toISOString() : null,
        endDate: end_date ? new Date(end_date).toISOString() : null,
        targetAudienceDescription: target_audience_description,
        avgTicket: avg_ticket,
    };
    return response;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    // --- AUTENTICAÇÃO (Exemplo, descomente e adapte) ---
    // const authUser = await verifyToken(req, res);
    // if (!authUser || typeof authUser.id !== 'number') {
    //   return res.status(401).json({ message: 'Autenticação requerida.' });
    // }
    // const userId = authUser.id; 
    const userId = 1; // <<<< REMOVER/SUBSTITUIR POR AUTENTICAÇÃO REAL
    console.log(`[API Campaigns] User ID (mock/real): ${userId}`);


    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();

        if (req.method === 'GET') {
            const { id } = req.query;
            if (id && typeof id === 'string') {
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
                if (rows.length > 0) {
                    res.status(200).json(parseDbRecordToResponse(rows[0] as CampaignDbRecord));
                } else {
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                // Listagem - Adicionar filtros, paginação e ordenação conforme necessário
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [userId]);
                res.status(200).json(rows.map(row => parseDbRecordToResponse(row as CampaignDbRecord)));
            }
        }
        else if (req.method === 'POST') {
            const campaignRawInput: CampaignInput = req.body;
            if (!campaignRawInput.name || typeof campaignRawInput.name !== 'string' || campaignRawInput.name.trim() === '') {
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }
            if (!campaignRawInput.selectedClientAccountId) {
                return res.status(400).json({ error: 'Conta de Cliente Vinculada é obrigatória.' });
            }


            const campaignDbInput = mapInputToDbFields(campaignRawInput);
            const newCampaignId = crypto.randomUUID();

            const fieldsToInsert = ['id', 'user_id', ...Object.keys(campaignDbInput)];
            const placeholders = fieldsToInsert.map(() => '?').join(', ');
            const valuesToInsert = [newCampaignId, userId, ...Object.values(campaignDbInput)];
            
            const sql = `INSERT INTO campaigns (${fieldsToInsert.map(f => `\`${f}\``).join(', ')}) VALUES (${placeholders})`;
            
            console.log("[API Campaigns POST] SQL:", sql);
            console.log("[API Campaigns POST] Values:", valuesToInsert);

            await dbConnection.query(sql, valuesToInsert);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [newCampaignId, userId]);
            if (newCampaignRows.length > 0) {
                res.status(201).json(parseDbRecordToResponse(newCampaignRows[0] as CampaignDbRecord));
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const updateRawData: Partial<CampaignInput> = req.body;
            const updateDbData = mapInputToDbFields(updateRawData); 

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório' });
            }
            if (Object.keys(updateDbData).length === 0 ) {
                return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
            }
            
            const setClauses = Object.keys(updateDbData).map(key => `${dbConnection!.escapeId(key)} = ?`);
            const paramsForUpdate = [...Object.values(updateDbData), id, userId];
            
            const sql = `UPDATE campaigns SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
            console.log("[API Campaigns PUT] SQL:", sql);
            console.log("[API Campaigns PUT] Params:", paramsForUpdate);

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, paramsForUpdate);

            if (result.affectedRows === 0) {
                 const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
                if (checkRows.length === 0) return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
            }

            const [updatedCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
            if (updatedCampaignRows.length > 0) {
                res.status(200).json(parseDbRecordToResponse(updatedCampaignRows[0] as CampaignDbRecord));
            } else {
                res.status(404).json({ message: 'Campanha não encontrada após atualização.' });
            }
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório.' });
            }
            // Adicionar exclusão em cascata ou lógica para tabelas relacionadas (daily_metrics, etc.) se necessário
            const [result] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Campanha não encontrada para exclusão.' });
            }
            res.status(204).end();
        }
        else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ message: `Método ${req.method} não permitido` });
        }

    } catch (err: any) {
        console.error(`[API Campaigns ${req?.method}] Erro:`, err);
        res.status(500).json({ message: 'Erro interno do servidor', error: err?.message, code: err.code });
    } finally {
        if (dbConnection) {
            dbConnection.release();
        }
    }
}
