// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

interface CampaignInput {
    name?: string;
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
    targetAudience?: string | null;
    adFormat?: string | string[] | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    // Adicionando campos camelCase que podem vir do frontend
    dailyBudget?: number | string | null;
    costTraffic?: number | string | null;
    costCreative?: number | string | null;
    costOperational?: number | string | null;
    userId?: number | null;
}

interface CampaignDbRecord {
    id: string;
    name: string;
    user_id?: number | null;
    platform?: string | null;
    objective?: string | null;
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    target_audience?: string | null;
    segmentation?: string | null;
    ad_format?: string | null;
    avg_ticket?: number | null;
    purchase_frequency?: number | null;
    customer_lifespan?: number | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    created_at: string;
    updated_at: string;
}


interface CampaignResponse {
    id: string;
    name: string;
    user_id?: number | null;
    platform?: string[] | null;
    objective?: string[] | null;
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    targetAudience?: string | null;
    segmentation?: string | null;
    adFormat?: string[] | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    created_at: string;
    updated_at: string;
}

const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Helper para mapInputToDbFields, para checar se uma chave existe no modelo DB
class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; name?: any; user_id?: any; platform?: any; objective?: any; budget?: any; daily_budget?: any; duration?: any; industry?: any; target_audience?: any; segmentation?: any; ad_format?: any; avg_ticket?: any; purchase_frequency?: any; customer_lifespan?: any; status?: any; start_date?: any; end_date?: any; cost_traffic?: any; cost_creative?: any; cost_operational?: any; created_at?: any; updated_at?: any;
}
const campaignDbSchemaKeys = Object.keys(new CampaignDbRecordExample());


const mapInputToDbFields = (input: Partial<CampaignInput>): Partial<CampaignDbRecord> => {
    const dbFields: Partial<CampaignDbRecord> = {};
    
    for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            const value = (input as any)[key];
            const snakeKey = toSnakeCase(key);

            if (campaignDbSchemaKeys.includes(snakeKey)) {
                (dbFields as any)[snakeKey] = value;
            } else if (campaignDbSchemaKeys.includes(key)) { // Se a chave já estiver em snake_case ou for um nome igual
                (dbFields as any)[key] = value;
            }
        }
    }
    return dbFields;
};


const parseDbRecordToResponse = (dbRecord: CampaignDbRecord): CampaignResponse => {
    const { 
        platform: dbPlatform, 
        objective: dbObjective, 
        ad_format: dbAdFormat, 
        target_audience, 
        avg_ticket, 
        purchase_frequency, 
        customer_lifespan, 
        start_date, 
        end_date,
        // user_id, daily_budget, cost_traffic, cost_creative, cost_operational, // Estes já devem estar corretos
        ...restOfDbRecord 
    } = dbRecord;

    const responsePartial: Partial<CampaignResponse> = {
        ...restOfDbRecord,
    };

    try {
        if (dbPlatform && typeof dbPlatform === 'string') responsePartial.platform = JSON.parse(dbPlatform);
        else responsePartial.platform = null;
    } catch (e) { console.warn(`Erro parse platform ID ${dbRecord.id}: ${e}`); responsePartial.platform = null; }

    try {
        if (dbObjective && typeof dbObjective === 'string') responsePartial.objective = JSON.parse(dbObjective);
        else responsePartial.objective = null;
    } catch (e) { console.warn(`Erro parse objective ID ${dbRecord.id}: ${e}`); responsePartial.objective = null; }
    
    if (dbAdFormat) {
        try { responsePartial.adFormat = JSON.parse(dbAdFormat); } 
        catch (e) { console.warn(`Erro parse ad_format ID ${dbRecord.id}: ${e}`); responsePartial.adFormat = null; }
    } else { responsePartial.adFormat = null; }

    if (target_audience !== undefined) responsePartial.targetAudience = target_audience;
    if (avg_ticket !== undefined) responsePartial.avgTicket = avg_ticket;
    if (purchase_frequency !== undefined) responsePartial.purchaseFrequency = purchase_frequency;
    if (customer_lifespan !== undefined) responsePartial.customerLifespan = customer_lifespan;
    if (start_date !== undefined) responsePartial.startDate = start_date;
    if (end_date !== undefined) responsePartial.endDate = end_date;

    // Atribuir explicitamente para garantir que os tipos opcionais de CampaignResponse sejam satisfeitos
    // e que os campos obrigatórios de CampaignDbRecord estejam lá.
    const finalResponse: CampaignResponse = {
        id: dbRecord.id,
        name: dbRecord.name,
        user_id: dbRecord.user_id !== undefined ? dbRecord.user_id : null,
        platform: responsePartial.platform !== undefined ? responsePartial.platform : null,
        objective: responsePartial.objective !== undefined ? responsePartial.objective : null,
        budget: dbRecord.budget !== undefined ? dbRecord.budget : null,
        daily_budget: dbRecord.daily_budget !== undefined ? dbRecord.daily_budget : null,
        duration: dbRecord.duration !== undefined ? dbRecord.duration : null,
        industry: dbRecord.industry !== undefined ? dbRecord.industry : null,
        targetAudience: responsePartial.targetAudience !== undefined ? responsePartial.targetAudience : null,
        segmentation: dbRecord.segmentation !== undefined ? dbRecord.segmentation : null,
        adFormat: responsePartial.adFormat !== undefined ? responsePartial.adFormat : null,
        avgTicket: responsePartial.avgTicket !== undefined ? responsePartial.avgTicket : null,
        purchaseFrequency: responsePartial.purchaseFrequency !== undefined ? responsePartial.purchaseFrequency : null,
        customerLifespan: responsePartial.customerLifespan !== undefined ? responsePartial.customerLifespan : null,
        status: dbRecord.status !== undefined ? dbRecord.status : null,
        startDate: responsePartial.startDate !== undefined ? responsePartial.startDate : null,
        endDate: responsePartial.endDate !== undefined ? responsePartial.endDate : null,
        cost_traffic: dbRecord.cost_traffic !== undefined ? dbRecord.cost_traffic : null,
        cost_creative: dbRecord.cost_creative !== undefined ? dbRecord.cost_creative : null,
        cost_operational: dbRecord.cost_operational !== undefined ? dbRecord.cost_operational : null,
        created_at: dbRecord.created_at,
        updated_at: dbRecord.updated_at,
    };

    return finalResponse;
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
            const allowedDbFields = campaignDbSchemaKeys;

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
                    const requestedFieldsCamelOrSnake = fields.split(',').map(f => f.trim());
                    const dbFieldsToSelect = new Set<string>();

                    requestedFieldsCamelOrSnake.forEach(fInput => {
                        const fSnake = toSnakeCase(fInput);
                        if (allowedDbFields.includes(fSnake)) {
                            dbFieldsToSelect.add(fSnake);
                        } else if (allowedDbFields.includes(fInput)) { // Se já for snake ou nome igual
                            dbFieldsToSelect.add(fInput);
                        }
                    });
                     // Garantir que id e name sejam sempre selecionados se fields for usado,
                     // pois são importantes para parseDbRecordToResponse e para a UI geralmente
                    dbFieldsToSelect.add('id');
                    dbFieldsToSelect.add('name');
                    // Adicionar campos que são JSON no DB para poderem ser parseados
                    dbFieldsToSelect.add('platform');
                    dbFieldsToSelect.add('objective');
                    dbFieldsToSelect.add('ad_format');


                    if (dbFieldsToSelect.size > 0) {
                        selectFields = Array.from(dbFieldsToSelect).map(f => dbConnection!.escapeId(f)).join(', ');
                    } else {
                        selectFields = '*'; // Fallback se nenhum campo válido for encontrado
                    }
                }

                let query = `SELECT ${selectFields} FROM campaigns`;
                const queryParams: any[] = [];
                const whereClauses: string[] = [];

                if (user_id && typeof user_id === 'string' && /^\d+$/.test(user_id)) {
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
                    const sortFieldReqSnake = toSnakeCase(sortFieldReq);
                    
                    if (allowedDbFields.includes(sortFieldReqSnake) && ['asc', 'desc'].includes(sortOrderReq.toLowerCase())) { 
                        sortFieldDb = sortFieldReqSnake;
                        sortOrder = sortOrderReq.toUpperCase();
                    } else if (allowedDbFields.includes(sortFieldReq) && ['asc', 'desc'].includes(sortOrderReq.toLowerCase())) {
                        sortFieldDb = sortFieldReq;
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
            if (!campaignRawInput.name || typeof campaignRawInput.name !== 'string' || campaignRawInput.name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }

            const campaignDbInput = mapInputToDbFields(campaignRawInput);
            
            const fullCampaignDbData: CampaignDbRecord = {
                id: crypto.randomUUID(),
                name: campaignRawInput.name.trim(),
                user_id: campaignDbInput.user_id ?? null,
                platform: (campaignDbInput.platform && Array.isArray(campaignDbInput.platform)) ? JSON.stringify(campaignDbInput.platform) : (typeof campaignDbInput.platform === 'string' ? campaignDbInput.platform : null),
                objective: (campaignDbInput.objective && Array.isArray(campaignDbInput.objective)) ? JSON.stringify(campaignDbInput.objective) : (typeof campaignDbInput.objective === 'string' ? campaignDbInput.objective : null),
                budget: campaignDbInput.budget != null && String(campaignDbInput.budget).trim() !== '' ? Number(campaignDbInput.budget) : null,
                daily_budget: campaignDbInput.daily_budget != null && String(campaignDbInput.daily_budget).trim() !== '' ? Number(campaignDbInput.daily_budget) : null,
                duration: campaignDbInput.duration != null && String(campaignDbInput.duration).trim() !== '' ? Number(campaignDbInput.duration) : null,
                industry: campaignDbInput.industry ?? null,
                target_audience: campaignDbInput.target_audience ?? null,
                segmentation: campaignDbInput.segmentation ?? null,
                ad_format: (campaignDbInput.ad_format && Array.isArray(campaignDbInput.ad_format)) ? JSON.stringify(campaignDbInput.ad_format) : (typeof campaignDbInput.ad_format === 'string' ? campaignDbInput.ad_format : null),
                avg_ticket: campaignDbInput.avg_ticket != null && String(campaignDbInput.avg_ticket).trim() !== '' ? Number(campaignDbInput.avg_ticket) : null,
                purchase_frequency: campaignDbInput.purchase_frequency != null && String(campaignDbInput.purchase_frequency).trim() !== '' ? Number(campaignDbInput.purchase_frequency) : null,
                customer_lifespan: campaignDbInput.customer_lifespan != null && String(campaignDbInput.customer_lifespan).trim() !== '' ? Number(campaignDbInput.customer_lifespan) : null,
                status: campaignDbInput.status ?? 'draft',
                start_date: campaignDbInput.start_date ? new Date(campaignDbInput.start_date).toISOString().slice(0, 10) : null,
                end_date: campaignDbInput.end_date ? new Date(campaignDbInput.end_date).toISOString().slice(0, 10) : null,
                cost_traffic: campaignDbInput.cost_traffic != null && String(campaignDbInput.cost_traffic).trim() !== '' ? Number(campaignDbInput.cost_traffic) : 0.00,
                cost_creative: campaignDbInput.cost_creative != null && String(campaignDbInput.cost_creative).trim() !== '' ? Number(campaignDbInput.cost_creative) : 0.00,
                cost_operational: campaignDbInput.cost_operational != null && String(campaignDbInput.cost_operational).trim() !== '' ? Number(campaignDbInput.cost_operational) : 0.00,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            console.log("[API Campaigns POST] Dados Completos para DB:", fullCampaignDbData);

            const sql = `
                INSERT INTO campaigns (
                    id, name, user_id, platform, objective, budget, daily_budget, duration, industry,
                    target_audience, segmentation, ad_format, avg_ticket, purchase_frequency, customer_lifespan, 
                    status, start_date, end_date, cost_traffic, cost_creative, cost_operational
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                fullCampaignDbData.id, fullCampaignDbData.name, fullCampaignDbData.user_id,
                fullCampaignDbData.platform, fullCampaignDbData.objective,
                fullCampaignDbData.budget, fullCampaignDbData.daily_budget, fullCampaignDbData.duration,
                fullCampaignDbData.industry, fullCampaignDbData.target_audience, fullCampaignDbData.segmentation,
                fullCampaignDbData.ad_format, fullCampaignDbData.avg_ticket, fullCampaignDbData.purchase_frequency,
                fullCampaignDbData.customer_lifespan, fullCampaignDbData.status,
                fullCampaignDbData.start_date, fullCampaignDbData.end_date,
                fullCampaignDbData.cost_traffic, fullCampaignDbData.cost_creative, fullCampaignDbData.cost_operational
            ];

            console.log("[API Campaigns POST] SQL Query:", sql.substring(0, 300) + "...");
            console.log("[API Campaigns POST] Params:", JSON.stringify(params).substring(0,300) + "...");

            await dbConnection.query(sql, params);
            console.log("[API Campaigns POST] INSERT executado com sucesso. ID:", fullCampaignDbData.id);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [fullCampaignDbData.id]);
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
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(updateDbData).length === 0 ) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const paramsForUpdate: any[] = [];
            const allowedUpdateDbFields = campaignDbSchemaKeys.filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');

            Object.entries(updateDbData).forEach(([key, value]) => {
                if (value !== undefined && allowedUpdateDbFields.includes(key)) { // value !== undefined permite setar para null
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective', 'ad_format'].includes(key)) {
                        paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(key) && value) {
                        try { paramsForUpdate.push(new Date(value as string).toISOString().slice(0, 10));} catch {paramsForUpdate.push(null);}
                    } else if (value === null) {
                         paramsForUpdate.push(null);
                    } else if (typeof value === 'string' && (value.trim() === '') && !['name', 'industry', 'target_audience', 'segmentation'].includes(key) ) { // Campos numéricos ou de data não devem ser string vazia
                        paramsForUpdate.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'].includes(key)) {
                        const numValue = Number(value);
                        paramsForUpdate.push(isNaN(numValue) ? null : numValue);
                    } else {
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
                 console.log("[API Campaigns PUT] Nenhuma linha afetada, mas campanha existe. Dados podem ser os mesmos.");
            }

            const [updatedCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
             if (updatedCampaignRows.length > 0) {
                res.status(200).json(parseDbRecordToResponse(updatedCampaignRows[0] as CampaignDbRecord));
            } else {
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
