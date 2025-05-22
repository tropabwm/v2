// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { format, parseISO, isValid } from 'date-fns';

// Interface para os dados que o frontend envia (payload do POST/PUT)
// Usar camelCase aqui, pois é o que o frontend (CampaignManagerForm) provavelmente enviará
interface CampaignPayloadFromFrontend {
    name: string;
    user_id?: number | null; // A API deve obter isso do token, não do payload, por segurança
    client_name?: string | null;
    product_name?: string | null;
    platforms?: string[] | string | null;
    objective?: string[] | string | null;
    budget?: number | string | null;
    daily_budget?: number | string | null; // snake_case no DB, mas frontend pode enviar dailyBudget
    duration?: number | string | null;
    industry?: string | null;
    targetAudienceDescription?: string | null; // camelCase do frontend
    segmentationNotes?: string | null;       // camelCase do frontend
    adFormat?: string[] | string | null;     // camelCase do frontend (adFormat ou adFormats)
    avgTicket?: number | string | null;      // camelCase do frontend
    purchaseFrequency?: number | string | null;
    customerLifespan?: number | string | null;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    startDate?: string | null; // YYYY-MM-DD string
    endDate?: string | null;   // YYYY-MM-DD string
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    selectedClientAccountId?: string | null; // camelCase do frontend
    externalPlatformAccountId?: string | null; // camelCase
    platformSource?: string | null;           // camelCase
    externalCampaignId?: string | null;      // camelCase
}

// Tipo para a resposta da API para o frontend (campos JSON desserializados e nomes camelCase)
interface CampaignApiResponseData {
    id: string;
    name: string;
    user_id?: number | null;
    client_name?: string | null;
    product_name?: string | null;
    platforms?: string[] | null; // camelCase, plural
    objective?: string[] | null;
    budget?: number | null;
    daily_budget?: number | null; // snake_case do DB, mas aqui pode ser dailyBudget se convertido
    duration?: number | null;
    industry?: string | null;
    targetAudienceDescription?: string | null; // camelCase
    segmentationNotes?: string | null;       // camelCase
    adFormat?: string[] | null;              // camelCase (adFormat ou adFormats)
    avgTicket?: number | null;               // camelCase
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    status?: string | null;
    startDate?: string | null; // YYYY-MM-DD
    endDate?: string | null;   // YYYY-MM-DD
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    selectedClientAccountId?: string | null; // camelCase
    externalPlatformAccountId?: string | null; // camelCase
    platformSource?: string | null;           // camelCase
    externalCampaignId?: string | null;      // camelCase
    created_at: string;
    updated_at: string;
}

const frontendToDbFieldMap: Record<keyof CampaignPayloadFromFrontend, string | null> = {
    name: 'name',
    user_id: 'user_id',
    client_name: 'client_name',
    product_name: 'product_name',
    platforms: 'platform',
    objective: 'objective',
    budget: 'budget',
    daily_budget: 'daily_budget', // Frontend envia daily_budget, DB tem daily_budget
    duration: 'duration',
    industry: 'industry',
    targetAudienceDescription: 'target_audience', // Frontend: targetAudienceDescription -> DB: target_audience
    segmentationNotes: 'segmentation',       // Frontend: segmentationNotes -> DB: segmentation
    adFormat: 'ad_format',                   // Frontend: adFormat -> DB: ad_format
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

function deserializeCampaign(dbCampaign: any): CampaignApiResponseData {
    const campaign: Partial<CampaignApiResponseData> = { ...dbCampaign };

    // Desserializar JSON e Mapear nomes de snake_case (DB) para camelCase (Frontend)
    if (dbCampaign.platform && typeof dbCampaign.platform === 'string') campaign.platforms = JSON.parse(dbCampaign.platform);
    else if (Array.isArray(dbCampaign.platform)) campaign.platforms = dbCampaign.platform; else campaign.platforms = null;
    delete campaign.platform; // Remove a chave original do DB se existir

    if (dbCampaign.objective && typeof dbCampaign.objective === 'string') campaign.objective = JSON.parse(dbCampaign.objective);
    else if (Array.isArray(dbCampaign.objective)) campaign.objective = dbCampaign.objective; else campaign.objective = null;
    
    if (dbCampaign.ad_format && typeof dbCampaign.ad_format === 'string') campaign.adFormat = JSON.parse(dbCampaign.ad_format);
    else if (Array.isArray(dbCampaign.ad_format)) campaign.adFormat = dbCampaign.ad_format; else campaign.adFormat = null;
    if ('ad_format' in campaign) delete campaign.ad_format;


    if (dbCampaign.target_audience !== undefined) { campaign.targetAudienceDescription = dbCampaign.target_audience; delete campaign.target_audience;}
    if (dbCampaign.segmentation !== undefined) { campaign.segmentationNotes = dbCampaign.segmentation; delete campaign.segmentation;}
    if (dbCampaign.avg_ticket !== undefined) { campaign.avgTicket = Number(dbCampaign.avg_ticket); delete campaign.avg_ticket;}
    if (dbCampaign.purchase_frequency !== undefined) { campaign.purchaseFrequency = Number(dbCampaign.purchase_frequency); delete campaign.purchase_frequency;}
    if (dbCampaign.customer_lifespan !== undefined) { campaign.customerLifespan = Number(dbCampaign.customer_lifespan); delete campaign.customer_lifespan;}
    
    // Garantir que campos numéricos sejam números
    for (const key of ['budget', 'daily_budget', 'duration', 'cost_traffic', 'cost_creative', 'cost_operational'] as const) {
        if (campaign[key] !== undefined && campaign[key] !== null) {
            campaign[key] = Number(campaign[key]);
        }
    }
    if (campaign.start_date) campaign.startDate = format(new Date(campaign.start_date), 'yyyy-MM-dd'); delete campaign.start_date;
    if (campaign.end_date) campaign.endDate = format(new Date(campaign.end_date), 'yyyy-MM-dd'); delete campaign.end_date;

    if (dbCampaign.selected_client_account_id !== undefined) { campaign.selectedClientAccountId = dbCampaign.selected_client_account_id; delete campaign.selected_client_account_id;}
    if (dbCampaign.external_platform_account_id !== undefined) { campaign.externalPlatformAccountId = dbCampaign.external_platform_account_id; delete campaign.external_platform_account_id;}
    if (dbCampaign.platform_source !== undefined) { campaign.platformSource = dbCampaign.platform_source; delete campaign.platform_source;}
    if (dbCampaign.external_campaign_id !== undefined) { campaign.externalCampaignId = dbCampaign.external_campaign_id; delete campaign.external_campaign_id;}


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
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]); // AND user_id = ? , [id, userIdFromToken]
                if (rows.length > 0) {
                    res.status(200).json(deserializeCampaign(rows[0]));
                } else {
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                const allowedDbSortFields: { [key: string]: string } = { // Mapeia o que o cliente envia para colunas reais
                    name: 'name', status: 'status', created_at: 'created_at', budget: 'budget',
                    daily_budget: 'daily_budget', start_date: 'start_date', end_date: 'end_date',
                    selectedClientAccountId: 'selected_client_account_id', // Se o cliente envia 'selectedClientAccountId'
                };
                const dbSortBy = allowedDbSortFields[sortByClient as string] || 'created_at';
                const dbSortOrder = (sortOrderClient as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

                let selectQuery = `SELECT * FROM campaigns`; // Simplificado, pode ser otimizado com 'fields'
                const whereClauses: string[] = [];
                const queryParams: any[] = [];

                // whereClauses.push('user_id = ?'); // Sempre filtrar por usuário
                // queryParams.push(userIdFromToken);

                if (search && typeof search === 'string') { whereClauses.push('name LIKE ?'); queryParams.push(`%${search}%`); }
                if (filterStatus && typeof filterStatus === 'string') { whereClauses.push('status = ?'); queryParams.push(filterStatus); }
                if (selectedClientAccountId && typeof selectedClientAccountId === 'string') { whereClauses.push('selected_client_account_id = ?'); queryParams.push(selectedClientAccountId); }

                if (whereClauses.length > 0) selectQuery += ` WHERE ${whereClauses.join(' AND ')}`;

                const countQuery = `SELECT COUNT(*) as totalItems FROM campaigns ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}`;
                const [countResult] = await dbConnection.query<mysql.RowDataPacket[]>(countQuery, queryParams); // Params são os mesmos para count
                const totalItems = countResult[0]?.totalItems || 0;

                selectQuery += ` ORDER BY ${dbConnection.escapeId(dbSortBy)} ${dbSortOrder}`;
                
                const page = parseInt(pageStr as string, 10);
                const limit = parseInt(limitStr as string, 10);
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
            if (!campaignInput.name) return res.status(400).json({ error: 'Nome da campanha é obrigatório' });

            const newCampaignId = crypto.randomUUID();
            const dbData: Record<string, any> = { id: newCampaignId };
            // dbData.user_id = userIdFromToken; // Adicionar user_id do token

            for (const key in campaignInput) {
                const frontendKey = key as keyof CampaignPayloadFromFrontend;
                const dbKey = frontendToDbFieldMap[frontendKey];
                if (dbKey && campaignInput[frontendKey] !== undefined && campaignInput[frontendKey] !== null) {
                    let value = campaignInput[frontendKey];
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKey)) {
                        value = (Array.isArray(value) && value.length > 0) ? JSON.stringify(value) : 
                                (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKey) && value && typeof value === 'string') {
                        if (isValid(parseISO(value))) value = format(parseISO(value), 'yyyy-MM-dd'); else value = null;
                    } else if (value === '' && !['name', 'industry', 'client_name', 'product_name', 'targetAudienceDescription', 'segmentationNotes', 'platformSource', 'externalCampaignId', 'selectedClientAccountId', 'externalPlatformAccountId'].includes(frontendKey)) {
                        value = null; // Converte string vazia para null para campos não textuais/opcionais
                    }
                    if (value !== null) dbData[dbKey] = value; // Só adiciona se não for null após processamento
                }
            }
            if (!dbData.status) dbData.status = 'draft';

            const fields = Object.keys(dbData);
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(f => dbData[f]);

            const sql = `INSERT INTO campaigns (${fields.map(f => dbConnection.escapeId(f)).join(', ')}) VALUES (${placeholders})`;
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
                const frontendKey = key as keyof CampaignPayloadFromFrontend;
                const dbKey = frontendToDbFieldMap[frontendKey];
                if (dbKey && campaignInput[frontendKey] !== undefined) { // Permite null para limpar campo
                    let value = campaignInput[frontendKey];
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKey)) {
                        value = (Array.isArray(value) && value.length > 0) ? JSON.stringify(value) : 
                                (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKey) && typeof value === 'string') {
                        if (value === null || value.trim() === '') value = null;
                        else if (isValid(parseISO(value))) value = format(parseISO(value), 'yyyy-MM-dd');
                        else value = undefined; // Valor inválido, não atualizar
                    } else if (value === '' && !['name', 'industry', 'client_name', 'product_name', 'targetAudienceDescription', 'segmentationNotes', 'platformSource', 'externalCampaignId', 'selectedClientAccountId', 'externalPlatformAccountId'].includes(frontendKey)) {
                        value = null;
                    }
                    if (value !== undefined) dbDataToUpdate[dbKey] = value;
                }
            }

            if (Object.keys(dbDataToUpdate).length === 0) return res.status(400).json({ message: 'Nenhum campo válido para atualização' });

            const setClauses = Object.keys(dbDataToUpdate).map(key => `${dbConnection.escapeId(key)} = ?`).join(', ');
            const params = [...Object.values(dbDataToUpdate), id]; // , userIdFromToken

            const sql = `UPDATE campaigns SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`; // AND user_id = ?
            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, params);

            if (result.affectedRows === 0) { /* ... tratamento de não encontrado ... */ }
            const [updatedRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
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
