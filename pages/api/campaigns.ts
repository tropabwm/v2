// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql'; // Assumindo que db-mysql.ts exporta getDbPool
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
    // Campos camelCase que podem vir do frontend e precisam ser mapeados
    targetAudience?: string | null;
    adFormat?: string | string[] | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    startDate?: string | null;
    endDate?: string | null;
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
    platform?: string | null; // JSON array
    objective?: string | null; // JSON array
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    target_audience?: string | null; // JSON object
    segmentation?: string | null;
    ad_format?: string | null; // Pode ser string simples ou JSON array
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
    targetAudience?: any | null; // Alterado para any para aceitar objeto parseado
    segmentation?: string | null;
    adFormat?: string[] | string | null; // Alterado para aceitar string ou array
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

class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; name?: any; user_id?: any; platform?: any; objective?: any; budget?: any; daily_budget?: any; duration?: any; industry?: any; target_audience?: any; segmentation?: any; ad_format?: any; avg_ticket?: any; purchase_frequency?: any; customer_lifespan?: any; status?: any; start_date?: any; end_date?: any; cost_traffic?: any; cost_creative?: any; cost_operational?: any; created_at?: any; updated_at?: any;
}
const campaignDbSchemaKeys = Object.keys(new CampaignDbRecordExample());


const mapInputToDbFields = (input: Partial<CampaignInput>): Partial<CampaignDbRecord> => {
    const dbFields: Partial<CampaignDbRecord> = {};
    const inputProcessed = { ...input };

    // Mapeamento de camelCase para snake_case para chaves conhecidas
    const camelToSnakeMapping: { [key: string]: string } = {
        targetAudience: 'target_audience',
        adFormat: 'ad_format',
        avgTicket: 'avg_ticket',
        purchaseFrequency: 'purchase_frequency',
        customerLifespan: 'customer_lifespan',
        startDate: 'start_date',
        endDate: 'end_date',
        dailyBudget: 'daily_budget',
        costTraffic: 'cost_traffic',
        costCreative: 'cost_creative',
        costOperational: 'cost_operational',
        userId: 'user_id'
    };

    for (const camelKey in camelToSnakeMapping) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, camelKey)) {
            const snakeKey = camelToSnakeMapping[camelKey];
            (dbFields as any)[snakeKey] = (inputProcessed as any)[camelKey];
            delete (inputProcessed as any)[camelKey]; // Remove a chave camelCase após o processamento
        }
    }
    
    // Processa as chaves restantes (que já deveriam estar em snake_case ou são padrão)
    for (const key in inputProcessed) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, key)) {
            const value = (inputProcessed as any)[key];
            if (campaignDbSchemaKeys.includes(key)) { // Verifica se a chave existe no schema do DB
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
        target_audience: dbTargetAudience, 
        avg_ticket, 
        purchase_frequency, 
        customer_lifespan, 
        start_date, 
        end_date,
        ...restOfDbRecord 
    } = dbRecord;

    const responsePartial: Partial<CampaignResponse> = { ...restOfDbRecord };

    const tryParseJsonArrayOrReturnNull = (jsonString: string | null | undefined, fieldName: string, recordId: string): string[] | null => {
        if (typeof jsonString === 'string' && jsonString.trim()) {
            try {
                const parsed = JSON.parse(jsonString);
                return Array.isArray(parsed) ? parsed : (parsed ? [String(parsed)] : null);
            } catch (e) {
                console.warn(`Erro parse JSON array para '${fieldName}' ID ${recordId}: ${e}. Conteúdo: "${jsonString}". Retornando null.`);
                return null;
            }
        }
        return null;
    };
    
    const tryParseJsonObjectOrReturnNull = (jsonString: string | null | undefined, fieldName: string, recordId: string): any | null => {
        if (typeof jsonString === 'string' && jsonString.trim()) {
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                console.warn(`Erro parse JSON object para '${fieldName}' ID ${recordId}: ${e}. Conteúdo: "${jsonString}". Retornando null.`);
                return null;
            }
        }
        return null;
    };

    responsePartial.platform = tryParseJsonArrayOrReturnNull(dbPlatform, 'platform', dbRecord.id);
    responsePartial.objective = tryParseJsonArrayOrReturnNull(dbObjective, 'objective', dbRecord.id);
    responsePartial.targetAudience = tryParseJsonObjectOrReturnNull(dbTargetAudience, 'target_audience', dbRecord.id);

    if (dbAdFormat) {
        try {
            const parsedAdFormat = JSON.parse(dbAdFormat);
            responsePartial.adFormat = Array.isArray(parsedAdFormat) ? parsedAdFormat : [String(parsedAdFormat)];
        } catch (e) {
            // Se não for JSON, assume que é uma string simples e a retorna (ou coloca em um array)
            console.warn(`Campo 'ad_format' (ID ${dbRecord.id}) não é JSON válido, tratando como string: "${dbAdFormat}"`);
            responsePartial.adFormat = dbAdFormat; // Ou [dbAdFormat] se quiser sempre array
        }
    } else {
        responsePartial.adFormat = null;
    }
    
    if (avg_ticket !== undefined) responsePartial.avgTicket = avg_ticket;
    if (purchase_frequency !== undefined) responsePartial.purchaseFrequency = purchase_frequency;
    if (customer_lifespan !== undefined) responsePartial.customerLifespan = customer_lifespan;
    if (start_date !== undefined) responsePartial.startDate = start_date ? new Date(start_date).toISOString() : null;
    if (end_date !== undefined) responsePartial.endDate = end_date ? new Date(end_date).toISOString() : null;

    const finalResponse: CampaignResponse = {
        id: dbRecord.id,
        name: dbRecord.name,
        user_id: dbRecord.user_id ?? null,
        platform: responsePartial.platform,
        objective: responsePartial.objective,
        budget: dbRecord.budget ?? null,
        daily_budget: dbRecord.daily_budget ?? null,
        duration: dbRecord.duration ?? null,
        industry: dbRecord.industry ?? null,
        targetAudience: responsePartial.targetAudience,
        segmentation: dbRecord.segmentation ?? null,
        adFormat: responsePartial.adFormat,
        avgTicket: responsePartial.avgTicket,
        purchaseFrequency: responsePartial.purchaseFrequency,
        customerLifespan: responsePartial.customerLifespan,
        status: dbRecord.status ?? null,
        startDate: responsePartial.startDate,
        endDate: responsePartial.endDate,
        cost_traffic: dbRecord.cost_traffic ?? null,
        cost_creative: dbRecord.cost_creative ?? null,
        cost_operational: dbRecord.cost_operational ?? null,
        created_at: dbRecord.created_at ? new Date(dbRecord.created_at).toISOString() : new Date().toISOString(),
        updated_at: dbRecord.updated_at ? new Date(dbRecord.updated_at).toISOString() : new Date().toISOString(),
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
                        if (allowedDbFields.includes(fSnake)) dbFieldsToSelect.add(fSnake);
                        else if (allowedDbFields.includes(fInput)) dbFieldsToSelect.add(fInput);
                    });
                    dbFieldsToSelect.add('id'); dbFieldsToSelect.add('name');
                    dbFieldsToSelect.add('platform'); dbFieldsToSelect.add('objective');
                    dbFieldsToSelect.add('ad_format'); dbFieldsToSelect.add('target_audience');

                    if (dbFieldsToSelect.size > 0) {
                        selectFields = Array.from(dbFieldsToSelect).map(f => dbConnection!.escapeId(f)).join(', ');
                    } else {
                        selectFields = '*';
                    }
                }

                let query = `SELECT ${selectFields} FROM campaigns`;
                const queryParams: any[] = [];
                const whereClauses: string[] = [];

                if (user_id && typeof user_id === 'string' && /^\d+$/.test(user_id)) {
                    whereClauses.push('user_id = ?');
                    queryParams.push(parseInt(user_id, 10));
                }

                if (whereClauses.length > 0) query += ` WHERE ${whereClauses.join(' AND ')}`;
                
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

            const campaignMappedInput = mapInputToDbFields(campaignRawInput);
            
            const fullCampaignDbData: CampaignDbRecord = {
                id: crypto.randomUUID(),
                name: campaignMappedInput.name!.trim(), // Nome já validado
                user_id: campaignMappedInput.user_id ?? null,
                platform: (campaignMappedInput.platform && Array.isArray(campaignMappedInput.platform)) ? JSON.stringify(campaignMappedInput.platform) : (typeof campaignMappedInput.platform === 'string' ? campaignMappedInput.platform : null),
                objective: (campaignMappedInput.objective && Array.isArray(campaignMappedInput.objective)) ? JSON.stringify(campaignMappedInput.objective) : (typeof campaignMappedInput.objective === 'string' ? campaignMappedInput.objective : null),
                budget: campaignMappedInput.budget != null && String(campaignMappedInput.budget).trim() !== '' ? Number(campaignMappedInput.budget) : null,
                daily_budget: campaignMappedInput.daily_budget != null && String(campaignMappedInput.daily_budget).trim() !== '' ? Number(campaignMappedInput.daily_budget) : null,
                duration: campaignMappedInput.duration != null && String(campaignMappedInput.duration).trim() !== '' ? Number(campaignMappedInput.duration) : null,
                industry: campaignMappedInput.industry ?? null,
                target_audience: typeof campaignMappedInput.target_audience === 'object' && campaignMappedInput.target_audience !== null ? JSON.stringify(campaignMappedInput.target_audience) : (typeof campaignMappedInput.target_audience === 'string' ? campaignMappedInput.target_audience : null),
                segmentation: campaignMappedInput.segmentation ?? null,
                ad_format: (campaignMappedInput.ad_format && Array.isArray(campaignMappedInput.ad_format)) ? JSON.stringify(campaignMappedInput.ad_format) : (typeof campaignMappedInput.ad_format === 'string' ? campaignMappedInput.ad_format : null),
                avg_ticket: campaignMappedInput.avg_ticket != null && String(campaignMappedInput.avg_ticket).trim() !== '' ? Number(campaignMappedInput.avg_ticket) : null,
                purchase_frequency: campaignMappedInput.purchase_frequency != null && String(campaignMappedInput.purchase_frequency).trim() !== '' ? Number(campaignMappedInput.purchase_frequency) : null,
                customer_lifespan: campaignMappedInput.customer_lifespan != null && String(campaignMappedInput.customer_lifespan).trim() !== '' ? Number(campaignMappedInput.customer_lifespan) : null,
                status: campaignMappedInput.status ?? 'draft',
                start_date: campaignMappedInput.start_date ? new Date(campaignMappedInput.start_date).toISOString().slice(0, 10) : null,
                end_date: campaignMappedInput.end_date ? new Date(campaignMappedInput.end_date).toISOString().slice(0, 10) : null,
                cost_traffic: campaignMappedInput.cost_traffic != null && String(campaignMappedInput.cost_traffic).trim() !== '' ? Number(campaignMappedInput.cost_traffic) : 0.00,
                cost_creative: campaignMappedInput.cost_creative != null && String(campaignMappedInput.cost_creative).trim() !== '' ? Number(campaignMappedInput.cost_creative) : 0.00,
                cost_operational: campaignMappedInput.cost_operational != null && String(campaignMappedInput.cost_operational).trim() !== '' ? Number(campaignMappedInput.cost_operational) : 0.00,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            console.log("[API Campaigns POST] Dados Completos para DB:", JSON.stringify(fullCampaignDbData).substring(0,500));

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
            const updateMappedData = mapInputToDbFields(updateRawData); 

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(updateMappedData).length === 0 ) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const paramsForUpdate: any[] = [];
            const allowedUpdateDbFields = campaignDbSchemaKeys.filter(k => !['id', 'created_at', 'updated_at', 'user_id'].includes(k)); // user_id não deve ser atualizado aqui

            Object.entries(updateMappedData).forEach(([key, value]) => {
                if (value !== undefined && allowedUpdateDbFields.includes(key)) {
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective'].includes(key)) { // Esses são sempre arrays JSON
                        paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : null);
                    } else if (key === 'ad_format') { // Pode ser string ou array JSON
                         paramsForUpdate.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (key === 'target_audience') { // Deve ser um objeto JSON
                        paramsForUpdate.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(key) && value) {
                        try { paramsForUpdate.push(new Date(value as string).toISOString().slice(0, 10));} catch {paramsForUpdate.push(null);}
                    } else if (value === null || (typeof value === 'string' && value.trim() === '' && !['name', 'industry', 'segmentation', 'status'].includes(key) ) ) {
                         paramsForUpdate.push(null); // Campos numéricos ou de data podem ser null, mas não string vazia (exceto os permitidos)
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational'].includes(key)) {
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

            paramsForUpdate.push(id); // Adiciona o ID da campanha ao final dos parâmetros
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
                // Isso não deveria acontecer se a verificação anterior passou e affectedRows > 0 ou a campanha existia
                res.status(404).json({ message: 'Campanha não encontrada após tentativa de atualização bem-sucedida (ou dados inalterados).' });
            }
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string.' });
            }
            console.log(`[API Campaigns DELETE] Tentando deletar ID: ${id}`);
            
            // Considere transações se a exclusão em cascata for crítica
            await dbConnection.query('DELETE FROM daily_metrics WHERE campaign_id = ?', [id]);
            await dbConnection.query('DELETE FROM copies WHERE campaign_id = ?', [id]);
            // await dbConnection.query('DELETE FROM creatives WHERE campaign_id = ?', [id]); // Se não houver ON DELETE CASCADE
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
