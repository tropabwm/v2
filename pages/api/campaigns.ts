// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { format, parseISO } from 'date-fns'; // Para formatar datas

// Interface para os dados de entrada do frontend (pode manter camelCase aqui)
interface CampaignFormData {
    name: string;
    user_id?: number | null;
    client_name?: string | null; // Adicionado conforme schema
    product_name?: string | null; // Adicionado conforme schema
    platforms?: string[] | string | null; // Nome no frontend: platforms
    objective?: string[] | string | null;
    budget?: number | string | null;
    daily_budget?: number | string | null;
    duration?: number | string | null;
    industry?: string | null;
    targetAudience?: string | null; // Frontend: targetAudience -> DB: target_audience
    segmentation?: string | null;   // Frontend: segmentation -> DB: segmentation
    adFormat?: string[] | string | null; // Frontend: adFormat -> DB: ad_format
    avgTicket?: number | string | null; // Frontend: avgTicket -> DB: avg_ticket
    purchaseFrequency?: number | string | null; // Frontend: purchaseFrequency -> DB: purchase_frequency
    customerLifespan?: number | string | null; // Frontend: customerLifespan -> DB: customer_lifespan
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    startDate?: string | null;
    endDate?: string | null;
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    selected_client_account_id?: string | null;
    external_platform_account_id?: string | null;
    platform_source?: string | null;
    external_campaign_id?: string | null;
}

// Tipo para a resposta da API (campos JSON desserializados)
interface CampaignResponse extends Omit<CampaignFormData, 'platforms' | 'objective' | 'adFormat'> {
    id: string;
    created_at: string;
    updated_at: string;
    platforms?: string[] | null; // Nome na API de resposta (desserializado)
    objective?: string[] | null;
    ad_format?: string[] | null; // Nome na API de resposta (desserializado)
}

// Mapeia nomes de campos do frontend (camelCase) para nomes de colunas do DB (snake_case)
// Usado para construir a query SQL dinamicamente para INSERT/UPDATE
const frontendToDbFieldMap: Record<keyof CampaignFormData, string | null> = {
    name: 'name',
    user_id: 'user_id',
    client_name: 'client_name',
    product_name: 'product_name',
    platforms: 'platform', // Frontend 'platforms' (plural) mapeia para DB 'platform' (singular, JSON)
    objective: 'objective',
    budget: 'budget',
    daily_budget: 'daily_budget',
    duration: 'duration',
    industry: 'industry',
    targetAudience: 'target_audience', // Correção
    segmentation: 'segmentation',     // Correção
    adFormat: 'ad_format',           // Correção
    avgTicket: 'avg_ticket',         // Correção
    purchaseFrequency: 'purchase_frequency', // Correção
    customerLifespan: 'customer_lifespan', // Correção
    status: 'status',
    startDate: 'start_date',
    endDate: 'end_date',
    cost_traffic: 'cost_traffic',
    cost_creative: 'cost_creative',
    cost_operational: 'cost_operational',
    selected_client_account_id: 'selected_client_account_id',
    external_platform_account_id: 'external_platform_account_id',
    platform_source: 'platform_source',
    external_campaign_id: 'external_campaign_id',
};


// Função para desserializar campos JSON do banco de dados
function deserializeCampaign(dbCampaign: any): CampaignResponse {
    const campaign = { ...dbCampaign } as any;
    try {
        if (campaign.platform && typeof campaign.platform === 'string') {
            campaign.platforms = JSON.parse(campaign.platform); // Mapeia db 'platform' para 'platforms' na resposta
            delete campaign.platform; // Remove o campo original do DB da resposta final, se desejar
        } else if (Array.isArray(campaign.platform)) {
            campaign.platforms = campaign.platform; // Já é array
            delete campaign.platform;
        } else {
            campaign.platforms = null;
        }
    } catch (e) { console.warn(`[Deserialize] Erro parse platform ID ${campaign.id}: ${e}`); campaign.platforms = null; }

    try {
        if (campaign.objective && typeof campaign.objective === 'string') {
            campaign.objective = JSON.parse(campaign.objective);
        } else if (!Array.isArray(campaign.objective)) {
             campaign.objective = null;
        }
    } catch (e) { console.warn(`[Deserialize] Erro parse objective ID ${campaign.id}: ${e}`); campaign.objective = null; }

    try {
        if (campaign.ad_format && typeof campaign.ad_format === 'string') { // DB usa ad_format
            campaign.ad_format = JSON.parse(campaign.ad_format); // Resposta usa ad_format (array)
        } else if (Array.isArray(campaign.ad_format)) {
            // já é array
        }
         else {
            campaign.ad_format = null;
        }
    } catch (e) { console.warn(`[Deserialize] Erro parse ad_format ID ${campaign.id}: ${e}`); campaign.ad_format = null; }
    
    // Mapear snake_case do DB para camelCase do frontend na resposta, se necessário
    if (campaign.target_audience !== undefined) { campaign.targetAudience = campaign.target_audience; delete campaign.target_audience; }
    if (campaign.avg_ticket !== undefined) { campaign.avgTicket = campaign.avg_ticket; delete campaign.avg_ticket; }
    if (campaign.purchase_frequency !== undefined) { campaign.purchaseFrequency = campaign.purchase_frequency; delete campaign.purchase_frequency; }
    if (campaign.customer_lifespan !== undefined) { campaign.customerLifespan = campaign.customer_lifespan; delete campaign.customer_lifespan; }
    if (campaign.start_date !== undefined) { campaign.startDate = campaign.start_date; delete campaign.start_date; }
    if (campaign.end_date !== undefined) { campaign.endDate = campaign.end_date; delete campaign.end_date; }


    return campaign as CampaignResponse;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Received request. Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();
        console.log(`[API Campaigns ${req.method}] Conexão com DB obtida.`);

        if (req.method === 'GET') {
            const { id, fields, limit: limitStr, page: pageStr, sortBy: sortByStr, sortOrder: sortOrderStr, search, status: filterStatus, selectedClientAccountId } = req.query;
            // const userIdFromAuth = 1; // Substituir pela autenticação real

            if (id && typeof id === 'string') {
                console.log(`[API Campaigns GET ID] Buscando ID: ${id}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]); // AND user_id = ? Adicionar filtro de usuário
                if (rows.length > 0) {
                    res.status(200).json(deserializeCampaign(rows[0]));
                } else {
                    console.log(`[API Campaigns GET ID] Campanha ID ${id} não encontrada.`);
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                console.log("[API Campaigns GET List] Listando campanhas...");
                // Mapeamento de nomes de campo permitidos para ordenação/seleção para nomes de coluna reais do DB
                const allowedDbSortFields: Record<string, string> = {
                    name: 'name',
                    status: 'status',
                    created_at: 'created_at',
                    budget: 'budget',
                    daily_budget: 'daily_budget',
                    start_date: 'start_date',
                    end_date: 'end_date',
                    selected_client_account_id: 'selected_client_account_id'
                    // Adicione outros campos permitidos para ordenação
                };

                let selectFields = '*';
                if (fields && typeof fields === 'string') {
                    const requestedFields = fields.split(',')
                        .map(f => f.trim())
                        .map(f => frontendToDbFieldMap[f as keyof CampaignFormData] || f) // Tenta mapear, senão usa o original
                        .filter(f => Object.values(frontendToDbFieldMap).includes(f) || ['id', 'created_at', 'updated_at'].includes(f)); // Valida contra colunas do DB
                    if (requestedFields.length > 0) {
                        selectFields = requestedFields.map(f => dbConnection!.escapeId(f)).join(', ');
                    }
                }

                let query = `SELECT ${selectFields} FROM campaigns`;
                const queryParams: any[] = [];
                const whereClauses: string[] = [];

                // if (userIdFromAuth) { // Sempre filtrar por usuário logado
                //     whereClauses.push('user_id = ?');
                //     queryParams.push(userIdFromAuth);
                // }
                if (search && typeof search === 'string') {
                    whereClauses.push('name LIKE ?');
                    queryParams.push(`%${search}%`);
                }
                if (filterStatus && typeof filterStatus === 'string') {
                    whereClauses.push('status = ?');
                    queryParams.push(filterStatus);
                }
                if (selectedClientAccountId && typeof selectedClientAccountId === 'string') {
                    whereClauses.push('selected_client_account_id = ?');
                    queryParams.push(selectedClientAccountId);
                }


                if (whereClauses.length > 0) {
                    query += ` WHERE ${whereClauses.join(' AND ')}`;
                }

                // Contagem total de itens para paginação (com os mesmos filtros)
                let countQuery = `SELECT COUNT(*) as totalItems FROM campaigns`;
                if (whereClauses.length > 0) {
                    countQuery += ` WHERE ${whereClauses.join(' AND ')}`;
                }
                const [countResult] = await dbConnection.query<mysql.RowDataPacket[]>(countQuery, queryParams);
                const totalItems = countResult[0]?.totalItems || 0;


                const sortBy = typeof sortByStr === 'string' && allowedDbSortFields[sortByStr] ? allowedDbSortFields[sortByStr] : 'created_at';
                const sortOrder = typeof sortOrderStr === 'string' && ['asc', 'desc'].includes(sortOrderStr.toLowerCase()) ? sortOrderStr.toUpperCase() : 'DESC';
                query += ` ORDER BY ${dbConnection!.escapeId(sortBy)} ${sortOrder}`;
                
                const page = pageStr && parseInt(pageStr as string, 10) > 0 ? parseInt(pageStr as string, 10) : 1;
                const limit = limitStr && parseInt(limitStr as string, 10) > 0 ? parseInt(limitStr as string, 10) : 10;
                const offset = (page - 1) * limit;
                query += ` LIMIT ? OFFSET ?`;
                queryParams.push(limit, offset);

                console.log(`[API Campaigns GET List] Executing Query: ${query} with params: ${JSON.stringify(queryParams)}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(query, queryParams);

                res.status(200).json({
                    data: rows.map(deserializeCampaign),
                    pagination: {
                        totalItems,
                        totalPages: Math.ceil(totalItems / limit),
                        currentPage: page,
                        itemsPerPage: limit
                    }
                });
            }
        }
        else if (req.method === 'POST') {
            console.log("[API Campaigns POST] Requisição recebida.");
            const campaignInput: CampaignFormData = req.body;
            console.log("[API Campaigns POST] Dados recebidos no body:", campaignInput);

            if (!campaignInput.name || typeof campaignInput.name !== 'string' || campaignInput.name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }
            // Adicione mais validações aqui (ex: selectedClientAccountId, platforms, objective)

            const newCampaignId = crypto.randomUUID();
            const dbData: Record<string, any> = { id: newCampaignId };
            // const userId = 1; // Substituir pela autenticação real
            // if (userId) dbData.user_id = userId;

            for (const key in campaignInput) {
                const frontendKey = key as keyof CampaignFormData;
                const dbKey = frontendToDbFieldMap[frontendKey];
                if (dbKey && campaignInput[frontendKey] !== undefined) {
                    let value = campaignInput[frontendKey];
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKey)) {
                        value = (value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKey) && value) {
                        value = format(parseISO(value as string), 'yyyy-MM-dd');
                    } else if (value === '') { // Tratar strings vazias como null para campos não textuais
                        if (!['name', 'industry', 'targetAudience', 'segmentation', 'client_name', 'product_name', 'platform_source', 'external_campaign_id', 'selected_client_account_id', 'external_platform_account_id'].includes(frontendKey)) {
                            value = null;
                        }
                    }
                    dbData[dbKey] = value;
                }
            }
             if (dbData.status === undefined || dbData.status === null) {
                dbData.status = 'draft'; // Default status
            }


            const fields = Object.keys(dbData);
            const placeholders = fields.map(() => '?').join(', ');
            const values = Object.values(dbData);

            const sql = `INSERT INTO campaigns (${fields.map(f => dbConnection!.escapeId(f)).join(', ')}) VALUES (${placeholders})`;
            
            console.log("[API Campaigns POST] SQL Query:", sql.substring(0, 500) + "...");
            console.log("[API Campaigns POST] Params:", JSON.stringify(values).substring(0,500) + "...");

            await dbConnection.query(sql, values);
            console.log("[API Campaigns POST] INSERT executado com sucesso. ID:", newCampaignId);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [newCampaignId]);
            if (newCampaignRows.length > 0) {
                res.status(201).json(deserializeCampaign(newCampaignRows[0]));
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const campaignInput: Partial<CampaignFormData> = req.body;
            // const userId = 1; // Substituir pela autenticação real

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(campaignInput).length === 0) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const dbDataToUpdate: Record<string, any> = {};
            for (const key in campaignInput) {
                const frontendKey = key as keyof CampaignFormData;
                const dbKey = frontendToDbFieldMap[frontendKey];
                 if (dbKey && campaignInput[frontendKey] !== undefined) { // Permitir `null` para limpar campos
                    let value = campaignInput[frontendKey];
                    if (['platforms', 'objective', 'adFormat'].includes(frontendKey)) {
                        value = (value && Array.isArray(value) && value.length > 0) ? JSON.stringify(value) : 
                                (typeof value === 'string' && value.trim() !== '' ? JSON.stringify([value]) : null);
                    } else if (['startDate', 'endDate'].includes(frontendKey)) {
                        value = value ? format(parseISO(value as string), 'yyyy-MM-dd') : null;
                    } else if (value === '') {
                         if (!['name', 'industry', 'targetAudience', 'segmentation', 'client_name', 'product_name', 'platform_source', 'external_campaign_id', 'selected_client_account_id', 'external_platform_account_id'].includes(frontendKey)) {
                            value = null;
                        }
                    }
                    dbDataToUpdate[dbKey] = value;
                }
            }

            if (Object.keys(dbDataToUpdate).length === 0) {
                return res.status(400).json({ message: 'Nenhum campo válido para atualização.' });
            }

            const setClauses = Object.keys(dbDataToUpdate).map(key => `${dbConnection!.escapeId(key)} = ?`).join(', ');
            const params = [...Object.values(dbDataToUpdate), id]; // Adicionar userId no WHERE: , userId

            const sql = `UPDATE campaigns SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`; // AND user_id = ?
            console.log("[API Campaigns PUT] SQL Query:", sql.substring(0,300) + "...");
            console.log("[API Campaigns PUT] Params:", JSON.stringify(params).substring(0,300) + "...");

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(sql, params);

            if (result.affectedRows === 0) {
                const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [id]);
                if (checkRows.length === 0) {
                    return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
                }
                 // Se encontrou mas não afetou, pode ser que os dados sejam os mesmos ou filtro de user_id impediu
                console.warn(`[API Campaigns PUT] Nenhuma linha afetada para ID ${id}, mas a campanha existe.`);
            }

            const [updatedCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
             if (updatedCampaignRows.length > 0) {
                res.status(200).json(deserializeCampaign(updatedCampaignRows[0]));
            } else {
                res.status(404).json({ message: 'Campanha não encontrada após atualização.' });
            }
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            // const userId = 1; // Substituir pela autenticação real
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string.' });
            }
            console.log(`[API Campaigns DELETE] Tentando deletar ID: ${id}`);
            
            // As FKs na sua DB estão ON DELETE SET NULL ou ON DELETE CASCADE para a maioria,
            // então não precisa deletar manualmente de creatives, copies, alerts, daily_metrics, flows.
            // Verifique `fk_alerts_user_id` e `fk_mcp_saved_user_id` que são ON DELETE CASCADE se o user for deletado.

            const [result] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ?', [id]); // AND user_id = ?
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
        res.status(500).json({ message: 'Erro interno do servidor', error: err?.message ?? 'Erro desconhecido', code: err.code, sqlMessage: err.sqlMessage });
    } finally {
        if (dbConnection) {
            dbConnection.release();
            console.log(`[API Campaigns ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
