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

const mapInputToDbFields = (input: Partial<CampaignInput>): Partial<CampaignDbRecord> => {
    const dbFields: Partial<CampaignDbRecord> = {};
    const directMappingCamelToSnake: { [key: string]: keyof CampaignDbRecord } = {
        targetAudience: 'target_audience',
        adFormat: 'ad_format',
        avgTicket: 'avg_ticket',
        purchaseFrequency: 'purchase_frequency',
        customerLifespan: 'customer_lifespan',
        startDate: 'start_date',
        endDate: 'end_date',
        dailyBudget: 'daily_budget', // Exemplo se vier como dailyBudget
        costTraffic: 'cost_traffic',
        costCreative: 'cost_creative',
        costOperational: 'cost_operational',
        userId: 'user_id'
    };

    for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            const value = (input as any)[key];
            if (directMappingCamelToSnake[key]) {
                (dbFields as any)[directMappingCamelToSnake[key]] = value;
            } else if (Object.keys(dbFields).includes(toSnakeCase(key)) || Object.prototype.hasOwnProperty.call(new CampaignDbRecordExample(), toSnakeCase(key)) || Object.prototype.hasOwnProperty.call(new CampaignDbRecordExample(), key) ) {
                 // Se a chave já é snake_case ou é um campo válido diretamente
                (dbFields as any)[key] = value;
            }
        }
    }
    // Para garantir que campos que podem vir como snake_case do frontend também sejam incluídos
    // se não foram mapeados de um camelCase
    const snakeCaseKeysInInput = ['name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'target_audience', 'segmentation', 'ad_format', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'status', 'start_date', 'end_date', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'];
    snakeCaseKeysInInput.forEach(snakeKey => {
        if (Object.prototype.hasOwnProperty.call(input, snakeKey) && !Object.prototype.hasOwnProperty.call(dbFields, snakeKey)) {
            (dbFields as any)[snakeKey] = (input as any)[snakeKey];
        }
    });


    return dbFields;
};
// Helper para mapInputToDbFields, para checar se uma chave existe no modelo DB
class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; name?: any; user_id?: any; platform?: any; objective?: any; budget?: any; daily_budget?: any; duration?: any; industry?: any; target_audience?: any; segmentation?: any; ad_format?: any; avg_ticket?: any; purchase_frequency?: any; customer_lifespan?: any; status?: any; start_date?: any; end_date?: any; cost_traffic?: any; cost_creative?: any; cost_operational?: any; created_at?: any; updated_at?: any;
}


const parseDbRecordToResponse = (dbRecord: CampaignDbRecord): CampaignResponse => {
    const response: Partial<CampaignResponse> & { [key: string]: any } = { ...dbRecord };
    
    try { if (dbRecord.platform && typeof dbRecord.platform === 'string') response.platform = JSON.parse(dbRecord.platform); } catch (e) { console.warn(`Erro parse platform ID ${dbRecord.id}: ${e}`); response.platform = null;}
    try { if (dbRecord.objective && typeof dbRecord.objective === 'string') response.objective = JSON.parse(dbRecord.objective); } catch (e) { console.warn(`Erro parse objective ID ${dbRecord.id}: ${e}`); response.objective = null;}
    
    if (dbRecord.ad_format) {
        try { response.adFormat = JSON.parse(dbRecord.ad_format); } catch (e) { console.warn(`Erro parse ad_format ID ${dbRecord.id}: ${e}`); response.adFormat = null;}
    } else { response.adFormat = null; }
    delete response.ad_format;

    if (dbRecord.target_audience !== undefined) { response.targetAudience = dbRecord.target_audience; delete response.target_audience; }
    if (dbRecord.avg_ticket !== undefined) { response.avgTicket = dbRecord.avg_ticket; delete response.avg_ticket; }
    if (dbRecord.purchase_frequency !== undefined) { response.purchaseFrequency = dbRecord.purchase_frequency; delete response.purchase_frequency; }
    if (dbRecord.customer_lifespan !== undefined) { response.customerLifespan = dbRecord.customer_lifespan; delete response.customer_lifespan; }
    if (dbRecord.start_date !== undefined) { response.startDate = dbRecord.start_date; delete response.start_date; }
    if (dbRecord.end_date !== undefined) { response.endDate = dbRecord.end_date; delete response.end_date; }
    if (dbRecord.daily_budget !== undefined) { response.daily_budget = dbRecord.daily_budget; } // Mantem daily_budget se for o caso, ou pode mapear para dailyBudget se preferir consistência camelCase no response


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
            const campaignDbSchema = new CampaignDbRecordExample();
            const allowedDbFields = Object.keys(campaignDbSchema);


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
                    requestedFieldsInput.forEach(fCamel => { // Assume que fields vem em camelCase
                        const fSnake = toSnakeCase(fCamel);
                        if (allowedDbFields.includes(fSnake)) (tempMapInput as any)[fSnake] = true; // Mapeia para snake para mapInputToDbFields
                        else if (allowedDbFields.includes(fCamel)) (tempMapInput as any)[fCamel] = true; // Se já for snake ou nome igual
                    });
                    
                    const mappedToDbKeys = Object.keys(mapInputToDbFields(tempMapInput)); // mapInputToDbFields espera camelCase e retorna snake_case
                    const validDbFields = mappedToDbKeys.filter(f => allowedDbFields.includes(f));

                    if (validDbFields.length > 0) { 
                        selectFields = validDbFields.map(f => dbConnection!.escapeId(f)).join(', '); 
                    } else {
                        selectFields = 'id, name'; // Default seguro se nenhum campo válido for encontrado
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
                    const [sortFieldReqCamel, sortOrderReq = 'asc'] = sort.split(':');
                    const sortFieldReqSnake = toSnakeCase(sortFieldReqCamel);
                    
                    if (allowedDbFields.includes(sortFieldReqSnake) && ['asc', 'desc'].includes(sortOrderReq.toLowerCase())) { 
                        sortFieldDb = sortFieldReqSnake;
                        sortOrder = sortOrderReq.toUpperCase();
                    } else if (allowedDbFields.includes(sortFieldReqCamel) && ['asc', 'desc'].includes(sortOrderReq.toLowerCase())) { // Caso o campo de sort já seja snake_case
                        sortFieldDb = sortFieldReqCamel;
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
            
            // Garantir que todos os campos snake_case esperados pela query INSERT estejam presentes
            // mesmo que com valor null, se não vieram do input.
            const fullCampaignDbData: CampaignDbRecord = {
                id: crypto.randomUUID(),
                name: campaignRawInput.name.trim(), // Obrigatório
                user_id: campaignDbInput.user_id ?? (campaignRawInput.userId ?? null),
                platform: (campaignDbInput.platform && Array.isArray(campaignDbInput.platform)) ? JSON.stringify(campaignDbInput.platform) : (typeof campaignDbInput.platform === 'string' ? campaignDbInput.platform : null),
                objective: (campaignDbInput.objective && Array.isArray(campaignDbInput.objective)) ? JSON.stringify(campaignDbInput.objective) : (typeof campaignDbInput.objective === 'string' ? campaignDbInput.objective : null),
                budget: campaignDbInput.budget != null && String(campaignDbInput.budget) !== '' ? Number(campaignDbInput.budget) : null,
                daily_budget: campaignDbInput.daily_budget != null && String(campaignDbInput.daily_budget) !== '' ? Number(campaignDbInput.daily_budget) : (campaignRawInput.dailyBudget != null && String(campaignRawInput.dailyBudget) !== '' ? Number(campaignRawInput.dailyBudget) : null),
                duration: campaignDbInput.duration != null && String(campaignDbInput.duration) !== '' ? Number(campaignDbInput.duration) : null,
                industry: campaignDbInput.industry ?? null,
                target_audience: campaignDbInput.target_audience ?? (campaignRawInput.targetAudience ?? null),
                segmentation: campaignDbInput.segmentation ?? null,
                ad_format: (campaignDbInput.ad_format && Array.isArray(campaignDbInput.ad_format)) ? JSON.stringify(campaignDbInput.ad_format) : (typeof campaignDbInput.ad_format === 'string' ? campaignDbInput.ad_format : (campaignRawInput.adFormat && Array.isArray(campaignRawInput.adFormat)) ? JSON.stringify(campaignRawInput.adFormat) : (typeof campaignRawInput.adFormat === 'string' ? campaignRawInput.adFormat : null)),
                avg_ticket: campaignDbInput.avg_ticket ?? (campaignRawInput.avgTicket ?? null),
                purchase_frequency: campaignDbInput.purchase_frequency ?? (campaignRawInput.purchaseFrequency ?? null),
                customer_lifespan: campaignDbInput.customer_lifespan ?? (campaignRawInput.customerLifespan ?? null),
                status: campaignDbInput.status ?? 'draft',
                start_date: campaignDbInput.start_date ? new Date(campaignDbInput.start_date).toISOString().slice(0, 10) : (campaignRawInput.startDate ? new Date(campaignRawInput.startDate).toISOString().slice(0,10) : null),
                end_date: campaignDbInput.end_date ? new Date(campaignDbInput.end_date).toISOString().slice(0, 10) : (campaignRawInput.endDate ? new Date(campaignRawInput.endDate).toISOString().slice(0,10) : null),
                cost_traffic: campaignDbInput.cost_traffic != null && String(campaignDbInput.cost_traffic) !== '' ? Number(campaignDbInput.cost_traffic) : (campaignRawInput.costTraffic != null && String(campaignRawInput.costTraffic) !== '' ? Number(campaignRawInput.costTraffic) : 0.00),
                cost_creative: campaignDbInput.cost_creative != null && String(campaignDbInput.cost_creative) !== '' ? Number(campaignDbInput.cost_creative) : (campaignRawInput.costCreative != null && String(campaignRawInput.costCreative) !== '' ? Number(campaignRawInput.costCreative) : 0.00),
                cost_operational: campaignDbInput.cost_operational != null && String(campaignDbInput.cost_operational) !== '' ? Number(campaignDbInput.cost_operational) : (campaignRawInput.costOperational != null && String(campaignRawInput.costOperational) !== '' ? Number(campaignRawInput.costOperational) : 0.00),
                created_at: new Date().toISOString(), // será sobrescrito pelo default do DB
                updated_at: new Date().toISOString(), // será sobrescrito pelo default do DB
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
            if (Object.keys(updateDbData).length === 0 && Object.keys(updateRawData).filter(k => k in new CampaignDbRecordExample()).length === 0 ) { // Checa se há campos mapeáveis
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const paramsForUpdate: any[] = [];
            const campaignDbSchemaForUpdate = new CampaignDbRecordExample();
            const allowedUpdateDbFields = Object.keys(campaignDbSchemaForUpdate).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');


            Object.entries(updateDbData).forEach(([key, value]) => {
                if (value !== undefined && allowedUpdateDbFields.includes(key)) {
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective', 'ad_format'].includes(key)) {
                        paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(key) && value) {
                        try { paramsForUpdate.push(new Date(value as string).toISOString().slice(0, 10));} catch {paramsForUpdate.push(null);}
                    } else if (value === null || (typeof value === 'string' && value.trim() === '')) {
                         paramsForUpdate.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'].includes(key)) {
                        const numValue = Number(value);
                        paramsForUpdate.push(isNaN(numValue) ? null : numValue);
                    }
                     else {
                        paramsForUpdate.push(value);
                    }
                }
            });
             // Considerar também campos que vieram em camelCase e foram mapeados diretamente para snake_case por mapInputToDbFields
            Object.entries(updateRawData).forEach(([key, value]) => {
                const snakeKey = toSnakeCase(key);
                if (value !== undefined && allowedUpdateDbFields.includes(snakeKey) && !fieldsToUpdate.some(f => f.startsWith(dbConnection!.escapeId(snakeKey)))) {
                     fieldsToUpdate.push(`${dbConnection!.escapeId(snakeKey)} = ?`);
                     // Repetir lógica de formatação de valor
                    if (['platform', 'objective', 'ad_format'].includes(snakeKey)) {
                        paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(snakeKey) && value) {
                        try { paramsForUpdate.push(new Date(value as string).toISOString().slice(0, 10));} catch {paramsForUpdate.push(null);}
                    } else if (value === null || (typeof value === 'string' && value.trim() === '')) {
                         paramsForUpdate.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'].includes(snakeKey)) {
                        const numValue = Number(value);
                        paramsForUpdate.push(isNaN(numValue) ? null : numValue);
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
            
            // Considerar transação aqui se todas as deleções forem críticas em conjunto
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
