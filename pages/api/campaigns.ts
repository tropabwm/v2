// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

interface CampaignInput { // Representa o que o frontend PODE enviar (pode ser parcial para PUT)
    name?: string; // Name é opcional para PUT
    platform?: string | string[] | null;
    objective?: string | string[] | null;
    budget?: number | string | null;
    daily_budget?: number | string | null;
    duration?: number | string | null;
    industry?: string | null;
    target_audience?: string | null;
    segmentation?: string | null;
    ad_format?: string | string[] | null;
    avg_ticket?: number | null;
    purchase_frequency?: number | null;
    customer_lifespan?: number | null;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    start_date?: string | null;
    end_date?: string | null;
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    user_id?: number | null;

    // Campos que podem vir do frontend com camelCase
    targetAudience?: string | null;
    adFormat?: string | string[] | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    startDate?: string | null;
    endDate?: string | null;
}

interface CampaignDbRecord { // Representa a estrutura da tabela no DB (snake_case)
    id: string;
    name: string;
    user_id?: number | null;
    platform?: string | null; // JSON stringificado
    objective?: string | null; // JSON stringificado
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    target_audience?: string | null;
    segmentation?: string | null;
    ad_format?: string | null; // JSON stringificado
    avg_ticket?: number | null;
    purchase_frequency?: number | null;
    customer_lifespan?: number | null;
    status?: string | null;
    start_date?: string | null; // Formato YYYY-MM-DD
    end_date?: string | null;   // Formato YYYY-MM-DD
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    created_at: string;
    updated_at: string;
}


interface CampaignResponse { // O que a API retorna (pode ser camelCase se o frontend preferir)
    id: string;
    name: string;
    user_id?: number | null;
    platform?: string[] | null; // JSON parseado
    objective?: string[] | null; // JSON parseado
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    targetAudience?: string | null; // Mapeado de target_audience
    segmentation?: string | null;
    adFormat?: string[] | null; // Mapeado de ad_format (JSON parseado)
    avgTicket?: number | null; // Mapeado de avg_ticket
    purchaseFrequency?: number | null; // Mapeado de purchase_frequency
    customerLifespan?: number | null; // Mapeado de customer_lifespan
    status?: string | null;
    startDate?: string | null; // Mapeado de start_date
    endDate?: string | null;   // Mapeado de end_date
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    created_at: string;
    updated_at: string;
}


const mapInputToDbFields = (input: Partial<CampaignInput>): Partial<CampaignDbRecord> => {
    const dbFields: Partial<CampaignDbRecord> = {};
    for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            const value = (input as any)[key];
            if (key === 'targetAudience') dbFields['target_audience'] = value;
            else if (key === 'adFormat') dbFields['ad_format'] = value;
            else if (key === 'avgTicket') dbFields['avg_ticket'] = value;
            else if (key === 'purchaseFrequency') dbFields['purchase_frequency'] = value;
            else if (key === 'customerLifespan') dbFields['customer_lifespan'] = value;
            else if (key === 'startDate') dbFields['start_date'] = value;
            else if (key === 'endDate') dbFields['end_date'] = value;
            // Para campos que já são snake_case ou não precisam de mapeamento explícito
            // e são válidos para CampaignDbRecord
            else if (['name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'segmentation', 'status', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'].includes(key)) {
                 (dbFields as any)[key] = value;
            }
        }
    }
    return dbFields;
};

const parseDbRecordToResponse = (dbRecord: CampaignDbRecord): CampaignResponse => {
    const response: any = { ...dbRecord };
    try { if (response.platform && typeof response.platform === 'string') response.platform = JSON.parse(response.platform); } catch (e) { console.warn(`Erro parse platform ID ${response.id}: ${e}`); response.platform = null;}
    try { if (response.objective && typeof response.objective === 'string') response.objective = JSON.parse(response.objective); } catch (e) { console.warn(`Erro parse objective ID ${response.id}: ${e}`); response.objective = null;}
    try { if (response.ad_format && typeof response.ad_format === 'string') response.adFormat = JSON.parse(response.ad_format); else response.adFormat = null; delete response.ad_format; } catch (e) { console.warn(`Erro parse ad_format ID ${response.id}: ${e}`); response.adFormat = null; delete response.ad_format; }
    
    if (response.target_audience !== undefined) { response.targetAudience = response.target_audience; delete response.target_audience; }
    if (response.avg_ticket !== undefined) { response.avgTicket = response.avg_ticket; delete response.avg_ticket; }
    if (response.purchase_frequency !== undefined) { response.purchaseFrequency = response.purchase_frequency; delete response.purchase_frequency; }
    if (response.customer_lifespan !== undefined) { response.customerLifespan = response.customer_lifespan; delete response.customer_lifespan; }
    if (response.start_date !== undefined) { response.startDate = response.start_date; delete response.start_date; }
    if (response.end_date !== undefined) { response.endDate = response.end_date; delete response.end_date; }

    return response as CampaignResponse;
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Received request. Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();
        console.log(`[API Campaigns ${req.method}] Conexão com DB obtida.`);

        if (req.method === 'GET') {
            const { id, fields, limit, sort, user_id } = req.query;
            const allowedDbFields = ['id', 'user_id', 'name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'target_audience', 'segmentation', 'ad_format', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'status', 'start_date', 'end_date', 'cost_traffic', 'cost_creative', 'cost_operational', 'created_at', 'updated_at'];

            if (id && typeof id === 'string') {
                console.log(`[API Campaigns GET ID] Buscando ID: ${id}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
                if (rows.length > 0) {
                    res.status(200).json(parseDbRecordToResponse(rows[0] as CampaignDbRecord));
                } else {
                    console.log(`[API Campaigns GET ID] Campanha ID ${id} não encontrada.`);
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                console.log("[API Campaigns GET List] Listando campanhas...");
                let selectFields = '*';

                if (fields && typeof fields === 'string') {
                    const requestedFieldsInput = fields.split(',').map(f => f.trim());
                    const tempMapInput: Partial<CampaignInput> = {};
                    requestedFieldsInput.forEach(f => (tempMapInput as any)[f] = true);
                    const mappedToDbKeys = Object.keys(mapInputToDbFields(tempMapInput));
                    
                    const validDbFields = mappedToDbKeys.filter(f => allowedDbFields.includes(f));
                    if (validDbFields.length > 0) { 
                        selectFields = validDbFields.map(f => dbConnection!.escapeId(f)).join(', '); 
                    }
                }

                let query = `SELECT ${selectFields} FROM campaigns`;
                const queryParams: any[] = [];
                const whereClauses: string[] = [];

                if (user_id && typeof user_id === 'string') {
                    whereClauses.push('user_id = ?');
                    queryParams.push(parseInt(user_id, 10));
                }

                if (whereClauses.length > 0) {
                    query += ` WHERE ${whereClauses.join(' AND ')}`;
                }
                
                let sortFieldDb = 'created_at'; 
                let sortOrder = 'DESC'; 

                if (sort && typeof sort === 'string') {
                    const [sortFieldReq, sortOrderReq = 'asc'] = sort.split(':');
                    const tempSortInput: Partial<CampaignInput> = {}; 
                    (tempSortInput as any)[sortFieldReq] = true;
                    const mappedSortField = Object.keys(mapInputToDbFields(tempSortInput))[0];

                    if (allowedDbFields.includes(mappedSortField) && ['asc', 'desc'].includes(sortOrderReq.toLowerCase())) { 
                        sortFieldDb = mappedSortField;
                        sortOrder = sortOrderReq.toUpperCase();
                    }
                }
                query += ` ORDER BY ${dbConnection!.escapeId(sortFieldDb)} ${sortOrder}`;

                const defaultLimit = 50;
                let limitNum = defaultLimit;
                if (limit && typeof limit === 'string' && /^\d+$/.test(limit)) {
                    const requestedLimit = parseInt(limit, 10);
                    if (requestedLimit > 0) limitNum = requestedLimit;
                }
                query += ` LIMIT ${limitNum}`;

                console.log(`[API Campaigns GET List] Executing Query: ${query} with params: ${JSON.stringify(queryParams)}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(query, queryParams);
                res.status(200).json(rows.map(row => parseDbRecordToResponse(row as CampaignDbRecord)));
            }
        }
        else if (req.method === 'POST') {
            console.log("[API Campaigns POST] Requisição recebida.");
            const campaignRawInput: CampaignInput = req.body;
            // Name é obrigatório para POST
            if (!campaignRawInput.name || typeof campaignRawInput.name !== 'string' || campaignRawInput.name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }

            const campaignDbInput = mapInputToDbFields(campaignRawInput) as CampaignDbRecord; // Mapeia para snake_case
            campaignDbInput.name = campaignRawInput.name.trim(); // Garantir que name está presente e trimado
            console.log("[API Campaigns POST] Dados para DB:", campaignDbInput);


            const id = crypto.randomUUID();
            const platformJson = (campaignDbInput.platform && Array.isArray(campaignDbInput.platform)) ? JSON.stringify(campaignDbInput.platform) : (typeof campaignDbInput.platform === 'string' ? campaignDbInput.platform : null);
            const objectiveJson = (campaignDbInput.objective && Array.isArray(campaignDbInput.objective)) ? JSON.stringify(campaignDbInput.objective) : (typeof campaignDbInput.objective === 'string' ? campaignDbInput.objective : null);
            const adFormatJson = (campaignDbInput.ad_format && Array.isArray(campaignDbInput.ad_format)) ? JSON.stringify(campaignDbInput.ad_format) : (typeof campaignDbInput.ad_format === 'string' ? campaignDbInput.ad_format : null);

            const sql = `
                INSERT INTO campaigns (
                    id, name, user_id, platform, objective, budget, daily_budget, duration, industry,
                    target_audience, segmentation, ad_format, avg_ticket, purchase_frequency, customer_lifespan, 
                    status, start_date, end_date, cost_traffic, cost_creative, cost_operational
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id, campaignDbInput.name, campaignDbInput.user_id ?? null,
                platformJson, objectiveJson,
                campaignDbInput.budget != null && String(campaignDbInput.budget) !== '' ? Number(campaignDbInput.budget) : null,
                campaignDbInput.daily_budget != null && String(campaignDbInput.daily_budget) !== '' ? Number(campaignDbInput.daily_budget) : null,
                campaignDbInput.duration != null && String(campaignDbInput.duration) !== '' ? Number(campaignDbInput.duration) : null,
                campaignDbInput.industry ?? null, campaignDbInput.target_audience ?? null, campaignDbInput.segmentation ?? null,
                adFormatJson,
                campaignDbInput.avg_ticket ?? null, campaignDbInput.purchase_frequency ?? null, campaignDbInput.customer_lifespan ?? null,
                campaignDbInput.status ?? 'draft',
                campaignDbInput.start_date ? new Date(campaignDbInput.start_date).toISOString().slice(0, 10) : null,
                campaignDbInput.end_date ? new Date(campaignDbInput.end_date).toISOString().slice(0, 10) : null,
                campaignDbInput.cost_traffic != null && String(campaignDbInput.cost_traffic) !== '' ? Number(campaignDbInput.cost_traffic) : 0.00,
                campaignDbInput.cost_creative != null && String(campaignDbInput.cost_creative) !== '' ? Number(campaignDbInput.cost_creative) : 0.00,
                campaignDbInput.cost_operational != null && String(campaignDbInput.cost_operational) !== '' ? Number(campaignDbInput.cost_operational) : 0.00
            ];

            console.log("[API Campaigns POST] SQL Query:", sql.substring(0, 300) + "...");
            console.log("[API Campaigns POST] Params:", JSON.stringify(params).substring(0,300) + "...");

            await dbConnection.query(sql, params);
            console.log("[API Campaigns POST] INSERT executado com sucesso. ID:", id);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
            if (newCampaignRows.length > 0) {
                res.status(201).json(parseDbRecordToResponse(newCampaignRows[0] as CampaignDbRecord));
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const updateRawData: Partial<CampaignInput> = req.body;
            // A função mapInputToDbFields agora aceita Partial<CampaignInput>
            const updateDbData = mapInputToDbFields(updateRawData); 

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(updateDbData).length === 0) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const paramsForUpdate: any[] = [];
            const allowedUpdateDbFields = ['name', 'user_id', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'target_audience', 'segmentation', 'ad_format', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'status', 'start_date', 'end_date', 'cost_traffic', 'cost_creative', 'cost_operational'];

            Object.entries(updateDbData).forEach(([key, value]) => {
                // Verificamos se a chave (já em snake_case vinda de mapInputToDbFields) é permitida
                if (value !== undefined && allowedUpdateDbFields.includes(key)) {
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective', 'ad_format'].includes(key)) {
                        paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(key) && value) {
                        paramsForUpdate.push(new Date(value as string).toISOString().slice(0, 10));
                    } else if (value === null || (typeof value === 'string' && value.trim() === '')) {
                         paramsForUpdate.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational'].includes(key)) {
                        const numValue = Number(value);
                        paramsForUpdate.push(isNaN(numValue) ? null : numValue); // Evita NaN
                    }
                     else {
                        paramsForUpdate.push(value);
                    }
                }
            });

            if (fieldsToUpdate.length === 0) {
                return res.status(400).json({ message: 'Nenhum campo válido para atualização.' });
            }

            paramsForUpdate.push(id);
            const sql = `UPDATE campaigns SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            console.log("[API Campaigns PUT] SQL Query:", sql.substring(0,300) + "...");
            console.log("[API Campaigns PUT] Params:", JSON.stringify(paramsForUpdate).substring(0,300) + "...");

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, paramsForUpdate);

            if (result.affectedRows === 0) {
                const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [id]);
                if (checkRows.length === 0) {
                    return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
                }
                // Se a campanha existe mas nada foi alterado (dados iguais), ainda é um "sucesso"
                 console.log("[API Campaigns PUT] Nenhuma linha afetada, mas campanha existe. Dados podem ser os mesmos.");
            }

            const [updatedCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
             if (updatedCampaignRows.length > 0) {
                res.status(200).json(parseDbRecordToResponse(updatedCampaignRows[0] as CampaignDbRecord));
            } else {
                 // Isso não deveria acontecer se result.affectedRows > 0 ou se a campanha existia
                res.status(404).json({ message: 'Campanha não encontrada após tentativa de atualização.' });
            }
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string.' });
            }
            console.log(`[API Campaigns DELETE] Tentando deletar ID: ${id}`);
            
            await dbConnection.query('DELETE FROM daily_metrics WHERE campaign_id = ?', [id]);
            await dbConnection.query('DELETE FROM copies WHERE campaign_id = ?', [id]);
            await dbConnection.query('DELETE FROM creatives WHERE campaign_id = ?', [id]);
            await dbConnection.query('DELETE FROM flows WHERE campaign_id = ?', [id]);
            await dbConnection.query('DELETE FROM alerts WHERE campaign_id = ?', [id]);

            const [result] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ?', [id]);
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
        console.error(`[API Campaigns ${req?.method || 'Unknown'}] Erro GERAL no try/catch:`, err.message, err.stack, err.code, err.sqlMessage);
        res.status(500).json({ message: 'Erro interno do servidor', error: err?.message ?? 'Erro desconhecido', code: err.code });
    } finally {
        if (dbConnection) {
            dbConnection.release();
            console.log(`[API Campaigns ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
