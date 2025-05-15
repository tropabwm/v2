// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

interface CampaignInput {
    name: string;
    platform?: string | string[] | null;
    objective?: string | string[] | null;
    budget?: number | string | null;
    daily_budget?: number | string | null;
    duration?: number | string | null;
    industry?: string | null;
    target_audience?: string | null; // CORRIGIDO para snake_case
    segmentation?: string | null;
    ad_format?: string | string[] | null; // CORRIGIDO para snake_case
    avg_ticket?: number | null; // CORRIGIDO para snake_case
    purchase_frequency?: number | null; // CORRIGIDO para snake_case
    customer_lifespan?: number | null; // CORRIGIDO para snake_case
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    start_date?: string | null;   // CORRIGIDO para snake_case (recebe string, converte para DATE SQL)
    end_date?: string | null;     // CORRIGIDO para snake_case (recebe string, converte para DATE SQL)
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    user_id?: number | null;
    // Campos que podem vir do frontend com camelCase, mas precisam ser mapeados para snake_case no DB
    targetAudience?: string | null;
    adFormat?: string | string[] | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    startDate?: string | null;
    endDate?: string | null;
}

interface CampaignResponse { // A resposta pode manter camelCase se o frontend preferir
    id: string;
    name: string;
    user_id?: number | null;
    platform?: string[] | null;
    objective?: string[] | null;
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    target_audience?: string | null;
    segmentation?: string | null;
    ad_format?: string[] | null;
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


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Received request. Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    const mapInputToDbFields = (input: CampaignInput): any => {
        const dbFields: any = {};
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
                else dbFields[key] = value;
            }
        }
        return dbFields;
    };
    
    const parseJsonFieldsForResponse = (campaign: any): CampaignResponse => {
        const parsedCampaign = { ...campaign };
        try { if (parsedCampaign.platform && typeof parsedCampaign.platform === 'string') parsedCampaign.platform = JSON.parse(parsedCampaign.platform); } catch (e) { console.warn(`Erro parse platform ID ${parsedCampaign.id}: ${e}`); parsedCampaign.platform = null;}
        try { if (parsedCampaign.objective && typeof parsedCampaign.objective === 'string') parsedCampaign.objective = JSON.parse(parsedCampaign.objective); } catch (e) { console.warn(`Erro parse objective ID ${parsedCampaign.id}: ${e}`); parsedCampaign.objective = null;}
        try { if (parsedCampaign.ad_format && typeof parsedCampaign.ad_format === 'string') parsedCampaign.ad_format = JSON.parse(parsedCampaign.ad_format); } catch (e) { console.warn(`Erro parse ad_format ID ${parsedCampaign.id}: ${e}`); parsedCampaign.ad_format = null;}
        // Mapear snake_case do DB para camelCase na resposta, se desejado pelo frontend
        if (parsedCampaign.target_audience !== undefined) { parsedCampaign.targetAudience = parsedCampaign.target_audience; delete parsedCampaign.target_audience; }
        if (parsedCampaign.ad_format !== undefined) { parsedCampaign.adFormat = parsedCampaign.ad_format; delete parsedCampaign.ad_format; }
        if (parsedCampaign.avg_ticket !== undefined) { parsedCampaign.avgTicket = parsedCampaign.avg_ticket; delete parsedCampaign.avg_ticket; }
        if (parsedCampaign.purchase_frequency !== undefined) { parsedCampaign.purchaseFrequency = parsedCampaign.purchase_frequency; delete parsedCampaign.purchase_frequency; }
        if (parsedCampaign.customer_lifespan !== undefined) { parsedCampaign.customerLifespan = parsedCampaign.customer_lifespan; delete parsedCampaign.customer_lifespan; }
        if (parsedCampaign.start_date !== undefined) { parsedCampaign.startDate = parsedCampaign.start_date; delete parsedCampaign.start_date; }
        if (parsedCampaign.end_date !== undefined) { parsedCampaign.endDate = parsedCampaign.end_date; delete parsedCampaign.end_date; }

        return parsedCampaign as CampaignResponse;
    };


    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();
        console.log(`[API Campaigns ${req.method}] Conexão com DB obtida.`);

        if (req.method === 'GET') {
            const { id, fields, limit, sort, user_id } = req.query;
            // Colunas permitidas no banco (snake_case)
            const allowedDbFields = ['id', 'user_id', 'name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'target_audience', 'segmentation', 'ad_format', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'status', 'start_date', 'end_date', 'cost_traffic', 'cost_creative', 'cost_operational', 'created_at', 'updated_at'];

            if (id && typeof id === 'string') {
                console.log(`[API Campaigns GET ID] Buscando ID: ${id}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
                if (rows.length > 0) {
                    res.status(200).json(parseJsonFieldsForResponse(rows[0]));
                } else {
                    console.log(`[API Campaigns GET ID] Campanha ID ${id} não encontrada.`);
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                console.log("[API Campaigns GET List] Listando campanhas...");
                let selectFields = '*';

                if (fields && typeof fields === 'string') {
                    // Mapear fields do request (potencialmente camelCase) para snake_case antes de validar
                    const requestedDbFields = fields.split(',').map(f => {
                        const tempInput: any = {}; tempInput[f.trim()] = true;
                        const mapped = mapInputToDbFields(tempInput);
                        return Object.keys(mapped)[0];
                    }).filter(f => allowedDbFields.includes(f));

                    if (requestedDbFields.length > 0) { selectFields = requestedDbFields.map(f => dbConnection!.escapeId(f)).join(', '); }
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
                
                let sortFieldDb = 'created_at'; // default
                let sortOrder = 'DESC'; // default

                if (sort && typeof sort === 'string') {
                    const [sortFieldReq, sortOrderReq = 'asc'] = sort.split(':');
                    const tempSortInput: any = {}; tempSortInput[sortFieldReq] = true;
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
                res.status(200).json(rows.map(parseJsonFieldsForResponse));
            }
        }
        else if (req.method === 'POST') {
            console.log("[API Campaigns POST] Requisição recebida.");
            const campaignRawInput: CampaignInput = req.body;
            const campaignDbInput = mapInputToDbFields(campaignRawInput); // Mapeia para snake_case
            console.log("[API Campaigns POST] Dados para DB:", campaignDbInput);

            if (!campaignDbInput.name || typeof campaignDbInput.name !== 'string' || campaignDbInput.name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }

            const id = crypto.randomUUID();
            const platformJson = (campaignDbInput.platform && Array.isArray(campaignDbInput.platform)) ? JSON.stringify(campaignDbInput.platform) : (typeof campaignDbInput.platform === 'string' ? campaignDbInput.platform : null);
            const objectiveJson = (campaignDbInput.objective && Array.isArray(campaignDbInput.objective)) ? JSON.stringify(campaignDbInput.objective) : (typeof campaignDbInput.objective === 'string' ? campaignDbInput.objective : null);
            const adFormatJson = (campaignDbInput.ad_format && Array.isArray(campaignDbInput.ad_format)) ? JSON.stringify(campaignDbInput.ad_format) : (typeof campaignDbInput.ad_format === 'string' ? campaignDbInput.ad_format : null);

            // Usar nomes de coluna snake_case aqui
            const sql = `
                INSERT INTO campaigns (
                    id, name, user_id, platform, objective, budget, daily_budget, duration, industry,
                    target_audience, segmentation, ad_format, avg_ticket, purchase_frequency, customer_lifespan, 
                    status, start_date, end_date, cost_traffic, cost_creative, cost_operational
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id, campaignDbInput.name.trim(), campaignDbInput.user_id ?? null,
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
                res.status(201).json(parseJsonFieldsForResponse(newCampaignRows[0]));
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const updateRawData: Partial<CampaignInput> = req.body;
            const updateDbData = mapInputToDbFields(updateRawData); // Mapeia para snake_case

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(updateDbData).length === 0) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const params: any[] = [];
            // Usar os nomes de coluna snake_case do banco
            const allowedUpdateDbFields = ['name', 'user_id', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'target_audience', 'segmentation', 'ad_format', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'status', 'start_date', 'end_date', 'cost_traffic', 'cost_creative', 'cost_operational'];

            Object.entries(updateDbData).forEach(([key, value]) => {
                if (value !== undefined && allowedUpdateDbFields.includes(key)) {
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective', 'ad_format'].includes(key)) {
                        params.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['start_date', 'end_date'].includes(key) && value) {
                        params.push(new Date(value as string).toISOString().slice(0, 10));
                    } else if (value === null || String(value).trim() === '') {
                         params.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avg_ticket', 'purchase_frequency', 'customer_lifespan', 'cost_traffic', 'cost_creative', 'cost_operational'].includes(key)) {
                        params.push(Number(value));
                    }
                     else {
                        params.push(value);
                    }
                }
            });

            if (fieldsToUpdate.length === 0) {
                return res.status(400).json({ message: 'Nenhum campo válido para atualização.' });
            }

            params.push(id);
            const sql = `UPDATE campaigns SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            console.log("[API Campaigns PUT] SQL Query:", sql.substring(0,300) + "...");
            console.log("[API Campaigns PUT] Params:", JSON.stringify(params).substring(0,300) + "...");

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, params);

            if (result.affectedRows === 0) {
                const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [id]);
                if (checkRows.length === 0) {
                    return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
                }
            }

            const [updatedCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
             if (updatedCampaignRows.length > 0) {
                res.status(200).json(parseJsonFieldsForResponse(updatedCampaignRows[0]));
            } else {
                res.status(404).json({ message: 'Campanha não encontrada após atualização (inesperado).' });
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
