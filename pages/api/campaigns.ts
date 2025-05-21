// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
// import { verifyToken } from '@/lib/auth'; // Descomente para autenticação real

// --- Interfaces Atualizadas ---
interface CampaignInput {
    name?: string;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    selectedClientAccountId?: string | null;
    
    platform?: string[] | null; 
    objective?: string[] | null;
    ad_format?: string[] | null;
    
    budget?: number | string | null;
    daily_budget?: number | string | null;
    start_date?: string | null; 
    end_date?: string | null;

    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null; // NOVO
    avg_ticket?: number | string | null;
    external_campaign_id?: string | null; // NOVO
    
    user_id?: number | null;

    // Mapeamento CamelCase (se vier do frontend assim)
    selectedclientaccountid?: string | null;
    dailyBudget?: number | string | null;
    startDate?: string | null;
    endDate?: string | null;
    targetAudienceDescription?: string | null;
    avgTicket?: number | string | null;
    externalCampaignId?: string | null; // NOVO
    segmentationNotes?: string | null; // NOVO
}

interface CampaignDbRecord {
    id: string;
    user_id: number;
    name: string;
    status: string;
    selected_client_account_id?: string | null;

    platforms?: string | null; 
    objectives?: string | null; 
    ad_formats?: string | null; 

    budget?: number | null;
    daily_budget?: number | null;
    start_date?: string | null; 
    end_date?: string | null;   

    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null; // NOVO
    avg_ticket?: number | null;
    
    external_campaign_id?: string | null; // NOVO
    // external_platform_account_id?: string | null; // Considere adicionar
    // platform_source?: string | null;             // Considere adicionar
    created_at: string;
    updated_at: string;
}

// A CampaignResponse pode ser mais seletiva ou mapear para camelCase
interface CampaignResponse { // Exemplo, ajuste conforme necessário
    id: string;
    name: string;
    status: string;
    selectedClientAccountId?: string | null;
    platforms?: string[] | null;
    objectives?: string[] | null;
    ad_formats?: string[] | null;
    budget?: number | null;
    dailyBudget?: number | null;
    startDate?: string | null; // ISO string
    endDate?: string | null;   // ISO string
    targetAudienceDescription?: string | null;
    industry?: string | null;
    segmentationNotes?: string | null; // NOVO
    avgTicket?: number | null;
    externalCampaignId?: string | null; // NOVO
    created_at: string;
    updated_at: string;
    user_id?: number; // Opcional, dependendo se o frontend precisa
}

const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Atualizar a lista de chaves do schema do DB para incluir os novos campos
class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; user_id?: any; name?: any; status?: any; selected_client_account_id?: any;
    platforms?: any; objectives?: any; ad_formats?: any; budget?: any; daily_budget?: any;
    start_date?: any; end_date?: any; target_audience_description?: any; industry?: any;
    segmentation_notes?: any; avg_ticket?: any; external_campaign_id?: any; 
    // external_platform_account_id?: any; platform_source?: any; 
    created_at?: any; updated_at?: any;
}
const campaignDbSchemaKeys = Object.keys(new CampaignDbRecordExample());

const mapInputToDbFields = (input: CampaignInput): Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> => {
    const dbFields: Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {};
    const inputProcessed = { ...input };

    // Mapeamento explícito de camelCase para snake_case para chaves conhecidas do frontend
    const camelToSnakeMapping: { [key: string]: keyof CampaignDbRecord } = {
        selectedClientAccountId: 'selected_client_account_id',
        dailyBudget: 'daily_budget',
        startDate: 'start_date',
        endDate: 'end_date',
        targetAudienceDescription: 'target_audience_description',
        avgTicket: 'avg_ticket',
        externalCampaignId: 'external_campaign_id', // NOVO
        segmentationNotes: 'segmentation_notes',   // NOVO
    };

    for (const camelKey in camelToSnakeMapping) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, camelKey)) {
            const snakeKey = camelToSnakeMapping[camelKey as keyof typeof camelToSnakeMapping];
            if (inputProcessed[camelKey as keyof CampaignInput] !== undefined) { // Só mapeia se existir no input
                 (dbFields as any)[snakeKey] = (inputProcessed as any)[camelKey];
            }
            delete (inputProcessed as any)[camelKey]; // Remove para não ser processado duas vezes
        }
    }
    
    // Processa chaves restantes (que já podem estar em snake_case ou são padrão)
    for (const key in inputProcessed) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, key)) {
            const value = (inputProcessed as any)[key];
            // Tenta converter para snake_case se não for um dos já mapeados explicitamente
            const snakeKey = campaignDbSchemaKeys.includes(key) ? key as keyof CampaignDbRecord : toSnakeCase(key) as keyof CampaignDbRecord;


            if (campaignDbSchemaKeys.includes(snakeKey)) {
                if (['platforms', 'objectives', 'ad_formats'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = Array.isArray(value) && value.length > 0 ? JSON.stringify(value) : null;
                } else if (['start_date', 'end_date'].includes(snakeKey) && value) {
                    try {
                        (dbFields as any)[snakeKey] = new Date(value as string).toISOString().slice(0, 10); // Formato YYYY-MM-DD
                    } catch { (dbFields as any)[snakeKey] = null; }
                } else if (['budget', 'daily_budget', 'avg_ticket'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = (value !== null && value !== undefined && String(value).trim() !== "") ? Number(value) : null;
                } else if (value === undefined || (typeof value === 'string' && value.trim() === '' && !['name', 'industry', 'status', 'target_audience_description', 'segmentation_notes', 'external_campaign_id'].includes(snakeKey))) {
                    // Campos de texto podem ser string vazia, outros não numéricos/data são null se vazios
                     (dbFields as any)[snakeKey] = null;
                }
                else {
                    (dbFields as any)[snakeKey] = value; // Aceita string vazia para campos de texto permitidos
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
        external_campaign_id, // NOVO
        segmentation_notes,   // NOVO
        user_id, // Incluído para possivelmente retornar
        ...restOfDbRecord 
    } = dbRecord;

    return {
        ...restOfDbRecord,
        user_id: user_id, // Adicionado
        platforms: dbPlatforms ? JSON.parse(dbPlatforms) : [], // Default para array vazio
        objectives: dbObjectives ? JSON.parse(dbObjectives) : [], // Default para array vazio
        ad_formats: dbAdFormats ? JSON.parse(dbAdFormats) : [], // Default para array vazio
        selectedClientAccountId: selected_client_account_id || null,
        dailyBudget: daily_budget || null,
        startDate: start_date ? new Date(start_date).toISOString() : null,
        endDate: end_date ? new Date(end_date).toISOString() : null,
        targetAudienceDescription: target_audience_description || null,
        avgTicket: avg_ticket || null,
        externalCampaignId: external_campaign_id || null, // NOVO
        segmentationNotes: segmentation_notes || null,   // NOVO
    };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // ... (código de autenticação e conexão com DB como antes) ...
    // const userId = authUser.id; 
    const userId = 1; // <<<< SUBSTITUIR POR AUTENTICAÇÃO REAL

    let dbConnection: mysql.PoolConnection | null = null;
    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();

        if (req.method === 'GET') {
            // ... (lógica GET como antes, `parseDbRecordToResponse` já está atualizada) ...
            const { id } = req.query;
            if (id && typeof id === 'string') {
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
                if (rows.length > 0) {
                    res.status(200).json(parseDbRecordToResponse(rows[0] as CampaignDbRecord));
                } else {
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [userId]);
                res.status(200).json(rows.map(row => parseDbRecordToResponse(row as CampaignDbRecord)));
            }

        } else if (req.method === 'POST') {
            const campaignRawInput: CampaignInput = req.body;
            // Validações básicas (podem ser expandidas com Zod)
            if (!campaignRawInput.name?.trim()) return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            if (!campaignRawInput.selectedClientAccountId) return res.status(400).json({ error: 'Conta de Cliente Vinculada é obrigatória.' });
            if (!campaignRawInput.platform || campaignRawInput.platform.length === 0) return res.status(400).json({ error: 'Selecione ao menos uma plataforma.'});

            const campaignDbInput = mapInputToDbFields(campaignRawInput);
            const newCampaignId = crypto.randomUUID();

            const fieldsToInsert = ['id', 'user_id', ...Object.keys(campaignDbInput)];
            const placeholders = fieldsToInsert.map(() => '?').join(', ');
            // Garantir que todos os valores em campaignDbInput sejam usados na ordem correta
            const valuesToInsert = [newCampaignId, userId];
            Object.keys(campaignDbInput).forEach(key => {
                valuesToInsert.push((campaignDbInput as any)[key]);
            });
            
            const sql = `INSERT INTO campaigns (${fieldsToInsert.map(f => `\`${f}\``).join(', ')}) VALUES (${placeholders})`;
            
            await dbConnection.query(sql, valuesToInsert);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [newCampaignId, userId]);
            if (newCampaignRows.length > 0) {
                res.status(201).json(parseDbRecordToResponse(newCampaignRows[0] as CampaignDbRecord));
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }

        } else if (req.method === 'PUT') {
            const { id } = req.query;
            const updateRawData: Partial<CampaignInput> = req.body;
            const updateDbData = mapInputToDbFields(updateRawData); 

            if (!id || typeof id !== 'string') return res.status(400).json({ message: 'ID da campanha é obrigatório' });
            if (Object.keys(updateDbData).length === 0 ) return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
            
            const setClauses = Object.keys(updateDbData).map(key => `${dbConnection!.escapeId(key)} = ?`);
            const paramsForUpdate = [...Object.values(updateDbData), id, userId];
            
            const sql = `UPDATE campaigns SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
            
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
        // ... (DELETE e outros métodos como antes) ...
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório.' });
            }
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
