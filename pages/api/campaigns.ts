// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { format, parseISO, isValid } from 'date-fns';

// Interface para os dados que o frontend envia (payload do POST/PUT)
interface CampaignPayloadFromFrontend {
    name: string;
    user_id?: number | null; 
    client_name?: string | null;
    product_name?: string | null;
    platforms?: string[] | string | null;
    objective?: string[] | string | null;
    budget?: number | string | null;
    daily_budget?: number | string | null;
    duration?: number | string | null;
    industry?: string | null;
    targetAudienceDescription?: string | null;
    segmentationNotes?: string | null;
    adFormat?: string[] | string | null; 
    avgTicket?: number | string | null;
    purchaseFrequency?: number | string | null;
    customerLifespan?: number | string | null;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    startDate?: string | null; 
    endDate?: string | null;  
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    selectedClientAccountId?: string | null;
    externalPlatformAccountId?: string | null;
    platformSource?: string | null;
    externalCampaignId?: string | null;
}

// Tipo para a resposta da API para o frontend
interface CampaignApiResponseData {
    id: string;
    name: string;
    user_id?: number | null;
    client_name?: string | null;
    product_name?: string | null;
    platforms?: string[] | null; // Frontend espera 'platforms' (plural, array)
    objective?: string[] | null;
    budget?: number | null;
    daily_budget?: number | null;
    duration?: number | null;
    industry?: string | null;
    targetAudienceDescription?: string | null; // Frontend espera 'targetAudienceDescription'
    segmentationNotes?: string | null;       // Frontend espera 'segmentationNotes'
    adFormat?: string[] | null;              // Frontend espera 'adFormat' (array)
    avgTicket?: number | null;               // Frontend espera 'avgTicket'
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    status?: string | null;
    startDate?: string | null; // YYYY-MM-DD
    endDate?: string | null;   // YYYY-MM-DD
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    selectedClientAccountId?: string | null; // Frontend espera 'selectedClientAccountId'
    externalPlatformAccountId?: string | null;
    platformSource?: string | null;
    externalCampaignId?: string | null;
    created_at: string;
    updated_at: string;
}

const frontendToDbFieldMap: Record<string, string | null> = { // Chave é o campo do frontend
    name: 'name',
    user_id: 'user_id', // Assumindo que o frontend pode enviar user_id, mas idealmente viria do token
    client_name: 'client_name',
    product_name: 'product_name',
    platforms: 'platform', // Frontend envia 'platforms' (array), DB armazena 'platform' (JSON)
    objective: 'objective', // Frontend envia 'objective' (array), DB armazena 'objective' (JSON)
    budget: 'budget',
    daily_budget: 'daily_budget', // Frontend envia 'daily_budget' (string/num), DB tem 'daily_budget'
    duration: 'duration',
    industry: 'industry',
    targetAudienceDescription: 'target_audience', // Frontend: targetAudienceDescription -> DB: target_audience
    segmentationNotes: 'segmentation',       // Frontend: segmentationNotes -> DB: segmentation
    adFormat: 'ad_format',                   // Frontend: adFormat (array) -> DB: ad_format (JSON)
    avgTicket: 'avg_ticket',                 // Frontend: avgTicket -> DB: avg_ticket
    purchaseFrequency: 'purchase_frequency',
    customerLifespan: 'customer_lifespan',
    status: 'status',
    startDate: 'start_date',
    endDate: 'end_date',
    cost_traffic: 'cost_traffic',
    cost_creative: 'cost_creative',
    cost_operational: 'cost_operational',
    selectedClientAccountId: 'selected_client_account_id',
    externalPlatformAccountId: 'external_platform_account_id',
    platformSource: 'platform_source',
    externalCampaignId: 'external_campaign_id',
};


function deserializeCampaign(dbCampaignData: any): CampaignApiResponseData {
    const dbCampaign = { ...dbCampaignData }; 
    const campaign: Partial<CampaignApiResponseData> = {};

    campaign.id = dbCampaign.id;
    campaign.name = dbCampaign.name;
    if (dbCampaign.user_id !== null && dbCampaign.user_id !== undefined) campaign.user_id = Number(dbCampaign.user_id);
    campaign.client_name = dbCampaign.client_name;
    campaign.product_name = dbCampaign.product_name;
    if (dbCampaign.budget !== null && dbCampaign.budget !== undefined) campaign.budget = Number(dbCampaign.budget);
    if (dbCampaign.daily_budget !== null && dbCampaign.daily_budget !== undefined) campaign.daily_budget = Number(dbCampaign.daily_budget);
    if (dbCampaign.duration !== null && dbCampaign.duration !== undefined) campaign.duration = Number(dbCampaign.duration);
    campaign.industry = dbCampaign.industry;
    campaign.status = dbCampaign.status;
    if (dbCampaign.cost_traffic !== null && dbCampaign.cost_traffic !== undefined) campaign.cost_traffic = Number(dbCampaign.cost_traffic);
    if (dbCampaign.cost_creative !== null && dbCampaign.cost_creative !== undefined) campaign.cost_creative = Number(dbCampaign.cost_creative);
    if (dbCampaign.cost_operational !== null && dbCampaign.cost_operational !== undefined) campaign.cost_operational = Number(dbCampaign.cost_operational);
    campaign.created_at = dbCampaign.created_at;
    campaign.updated_at = dbCampaign.updated_at;

    try { campaign.platforms = dbCampaign.platform ? JSON.parse(dbCampaign.platform) : null; } catch (e) { campaign.platforms = null; console.warn(`[Deserialize] Erro parse platform ID ${dbCampaign.id}: ${e}`);}
    try { campaign.objective = dbCampaign.objective ? JSON.parse(dbCampaign.objective) : null; } catch (e) { campaign.objective = null; console.warn(`[Deserialize] Erro parse objective ID ${dbCampaign.id}: ${e}`);}
    try { campaign.adFormat = dbCampaign.ad_format ? JSON.parse(dbCampaign.ad_format) : null; } catch (e) { campaign.adFormat = null; console.warn(`[Deserialize] Erro parse ad_format ID ${dbCampaign.id}: ${e}`);}
    
    campaign.targetAudienceDescription = dbCampaign.target_audience;
    campaign.segmentationNotes = dbCampaign.segmentation;
    if (dbCampaign.avg_ticket !== null && dbCampaign.avg_ticket !== undefined) campaign.avgTicket = Number(dbCampaign.avg_ticket);
    if (dbCampaign.purchase_frequency !== null && dbCampaign.purchase_frequency !== undefined) campaign.purchaseFrequency = Number(dbCampaign.purchase_frequency);
    if (dbCampaign.customer_lifespan !== null && dbCampaign.customer_lifespan !== undefined) campaign.customerLifespan = Number(dbCampaign.customer_lifespan);
    
    if (dbCampaign.start_date) campaign.startDate = format(new Date(dbCampaign.start_date), 'yyyy-MM-dd');
    if (dbCampaign.end_date) campaign.endDate = format(new Date(dbCampaign.end_date), 'yyyy-MM-dd');

    campaign.selectedClientAccountId = dbCampaign.selected_client_account_id;
    campaign.externalPlatformAccountId = dbCampaign.external_platform_account_id;
    campaign.platformSource = dbCampaign.platform_source;
    campaign.externalCampaignId = dbCampaign.external_campaign_id;

    return campaign as CampaignApiResponseData;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;
    // const userIdFromToken = 1; // TODO: Implementar verifyToken(req) para obter o user_id real

    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();

        if (req.method === 'GET') {
            const { id, fields, limit: limitStr = '10', page: pageStr = '1', sortBy: sortByClient = 'created_at', sortOrder: sortOrderClient = 'desc', search, status: filterStatus, selectedClientAccountId } = req.query;

            if (id && typeof id === 'string') {
                // Adicionar user_id ao SELECT se for necessário no deserializeCampaign
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]); // AND user_id = ? , [id, userIdFromToken]
                if (rows.length > 0) {
                    res.status(200).json(deserializeCampaign(rows[0]));
                } else {
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                const allowedDbSortFields: { [key: string]: string } = { 
                    name: 'name', status: 'status', created_at: 'created_at', budget: 'budget',
                    daily_budget: 'daily_budget', start_date: 'start_date', end_date: 'end_date',
                    selectedClientAccountId: 'selected_client_account_id',
                };
                const dbSortBy = allowedDbSortFields[sortByClient as string] || 'created_at';
                const dbSortOrder = (sortOrderClient as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

                let selectQuery = `SELECT * FROM campaigns`; 
                const whereClauses: string[] = [];
                const queryParams: any[] = [];

                // whereClauses.push('user_id = ?'); 
                // queryParams.push(userIdFromToken);

                if (search && typeof search === 'string' && search.trim() !== '') { whereClauses.push('name LIKE ?'); queryParams.push(`%${search}%`); }
                if (filterStatus && typeof filterStatus === 'string' && filterStatus.trim() !== '') { whereClauses.push('status = ?'); queryParams.push(filterStatus); }
                if (selectedClientAccountId && typeof selectedClientAccountId === 'string' && selectedClientAccountId.trim() !== '') { whereClauses.push('selected_client_account_id = ?'); queryParams.push(selectedClientAccountId); }

                let whereClauseString = "";
                if (whereClauses.length > 0) {
                    whereClauseString = ` WHERE ${whereClauses.join(' AND ')}`;
                    selectQuery += whereClauseString;
                }
                
                const countQuery = `SELECT COUNT(*) as totalItems FROM campaigns${whereClauseString}`;
                const [countResult] = await dbConnection.query<mysql.RowDataPacket[]>(countQuery, queryParams);
                const totalItems = countResult[0]?.totalItems || 0;

                selectQuery += ` ORDER BY ${dbConnection.escapeId(dbSortBy)} ${dbSortOrder}`;
                
                const page = parseInt(pageStr as string, 10) || 1;
                const limit = parseInt(limitStr as string, 10) || 10;
                const offset = (page - 1) * limit;
                selectQuery += ` LIMIT ? OFFSET ?`;
                const finalQueryParamsForSelect = [...queryParams, limit, offset];

                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(selectQuery, finalQueryParamsForSelect);
                res.status(200).json({
                    data: rows.map(deserializeCampaign),
                    pagination: { totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page, itemsPerPage: limit }
                });
            }
        }
        else if (req.method === 'POST') {
            const campaignInput = req.body as CampaignPayloadFromFrontend;
            if (!campaignInput.name || campaignInput.name.trim() === '') return res.status(400).json({ error: 'Nome da campanha é obrigatório' });

            const newCampaignId = crypto.randomUUID();
            const dbData: Record<string, any> = { id: newCampaignId };
            // dbData.user_id = userIdFromToken; 

            for (const key in campaignInput) {
                if (key === 'user_id' && campaignInput.user_id === undefined && dbData.user_id) { // Não sobrescrever user_id do token com undefined do payload
                    continue;
                }
                const frontendKeyTyped = key as keyof CampaignPayloadFromFrontend;
                const dbKey = frontendToDbFieldMap[frontendKeyTyped];

                if (dbKey && campaignInput[frontendKeyTyped] !== undefined) { // Permitir null para limpar campos
                    let value = campaignInput[frontendKeyTyped];
                    
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKeyTyped)) {
                        value = (Array.isArray(value) && value.length > 0) ? JSON.stringify(value) : 
                                (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value.trim()]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKeyTyped) && value && typeof value === 'string') {
                        if (isValid(parseISO(value))) value = format(parseISO(value), 'yyyy-MM-dd'); 
                        else value = null; // Data inválida se torna null
                    } else if (value === '' && !['name', 'industry', 'client_name', 'product_name', 'targetAudienceDescription', 'segmentationNotes', 'platformSource', 'externalCampaignId', 'selectedClientAccountId', 'externalPlatformAccountId'].includes(frontendKeyTyped)) {
                        value = null; 
                    }
                    // Somente adiciona ao dbData se o valor não for undefined após o processamento
                    // Null é permitido para limpar campos no DB.
                    if (value !== undefined) {
                        dbData[dbKey] = value;
                    }
                }
            }
            if (dbData.status === undefined || dbData.status === null) dbData.status = 'draft'; // Default status

            const fields = Object.keys(dbData);
            if (fields.length <= 1 && dbData.id) { // Apenas ID (e possivelmente user_id)
                return res.status(400).json({ error: "Nenhum campo válido fornecido para criação além do ID." });
            }
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(f => dbData[f]);

            const sql = `INSERT INTO campaigns (${fields.map(f => dbConnection.escapeId(f)).join(', ')}) VALUES (${placeholders})`;
            console.log("[API Campaigns POST] SQL:", sql, "Values:", values);
            await dbConnection.query(sql, values);

            const [newRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [newCampaignId]);
            res.status(201).json(deserializeCampaign(newRows[0]));
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') return res.status(400).json({ message: 'ID é obrigatório' });
            
            const campaignInput = req.body as Partial<CampaignPayloadFromFrontend>;
            if (Object.keys(campaignInput).length === 0) return res.status(400).json({ message: 'Nenhum campo para atualizar' });

            const dbDataToUpdate: Record<string, any> = {};
            for (const key in campaignInput) {
                if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') continue; // Não permitir atualização desses campos via payload

                const frontendKeyTyped = key as keyof CampaignPayloadFromFrontend;
                const dbKey = frontendToDbFieldMap[frontendKeyTyped];
                if (dbKey && campaignInput[frontendKeyTyped] !== undefined) {
                    let value = campaignInput[frontendKeyTyped];
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKeyTyped)) {
                         value = (Array.isArray(value) && value.length > 0) ? JSON.stringify(value) : 
                                (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value.trim()]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKeyTyped) && typeof value === 'string') {
                        if (value === null || value.trim() === '') value = null;
                        else if (isValid(parseISO(value))) value = format(parseISO(value), 'yyyy-MM-dd');
                        else value = undefined; 
                    } else if (value === '' && !['name', 'industry', 'client_name', 'product_name', 'targetAudienceDescription', 'segmentationNotes', 'platformSource', 'externalCampaignId', 'selectedClientAccountId', 'externalPlatformAccountId'].includes(frontendKeyTyped)) {
                        value = null;
                    }
                    if (value !== undefined) dbDataToUpdate[dbKey] = value;
                }
            }

            if (Object.keys(dbDataToUpdate).length === 0) return res.status(400).json({ message: 'Nenhum campo válido para atualização' });

            const setClauses = Object.keys(dbDataToUpdate).map(key => `${dbConnection.escapeId(key)} = ?`).join(', ');
            const params = [...Object.values(dbDataToUpdate), id]; // , userIdFromToken

            const sql = `UPDATE campaigns SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`; // AND user_id = ?
            console.log("[API Campaigns PUT] SQL:", sql, "Params:", params);
            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, params);

            if (result.affectedRows === 0) {
                 const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [id]);
                 if (checkRows.length === 0) return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
                 // Se encontrou mas não afetou, pode ser que os dados sejam os mesmos
                 console.warn(`[API Campaigns PUT] Nenhuma linha afetada para ID ${id}, mas a campanha existe.`);
            }
            const [updatedRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
            if (updatedRows.length === 0) return res.status(404).json({ message: 'Campanha não encontrada após tentativa de atualização.' });
            res.status(200).json(deserializeCampaign(updatedRows[0]));
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') return res.status(400).json({ message: 'ID é obrigatório' });
            // const [result] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [id, userIdFromToken]);
            const [result] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ?', [id]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Campanha não encontrada' });
            res.status(204).end();
        }
        else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ message: `Método ${req.method} não permitido` });
        }
    } catch (err: any) {
        console.error(`[API Campaigns ${req?.method}] Erro:`, err.message, err.code, err.sqlMessage, err.stack);
        res.status(500).json({ message: 'Erro interno', error: err.message, code: err.code, sqlMessage: err.sqlMessage });
    } finally {
        if (dbConnection) dbConnection.release();
    }
}
