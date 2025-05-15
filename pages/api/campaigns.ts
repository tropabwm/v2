// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Adicionado initializeAllTables
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
    targetAudience?: string | null; // Mantido como targetAudience para consistência com usos anteriores
    segmentation?: string | null;
    adFormat?: string | string[] | null; // Mantido como adFormat
    // Campos de métricas/resultados podem ser removidos da INSERÇÃO/ATUALIZAÇÃO manual se forem apenas derivados
    // revenue?: number | null; 
    // leads?: number | null;
    // clicks?: number | null;
    // sales?: number | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    status?: 'active' | 'paused' | 'completed' | 'draft' | 'archived' | null;
    startDate?: string | null; // Recebe string, converte para DATE SQL
    endDate?: string | null;   // Recebe string, converte para DATE SQL
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
    user_id?: number | null; // Adicionado para vincular ao usuário
}

// Tipo para a resposta da API
interface CampaignResponse extends CampaignInput {
    id: string;
    created_at: string;
    updated_at: string;
    // Os campos JSON devem ser desserializados para o frontend
    platform?: string[] | null;
    objective?: string[] | null;
    adFormat?: string[] | null;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`[API Campaigns Handler] Received request. Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    try {
        const dbPool = getDbPool();
        // await initializeAllTables(); // Garante que as tabelas existem - CHAME NO _APP OU EM UM INIT GLOBAL
        dbConnection = await dbPool.getConnection();
        console.log(`[API Campaigns ${req.method}] Conexão com DB obtida.`);


        if (req.method === 'GET') {
            const { id, fields, limit, sort, user_id } = req.query;

            if (id && typeof id === 'string') {
                console.log(`[API Campaigns GET ID] Buscando ID: ${id}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
                if (rows.length > 0) {
                    const campaign = { ...rows[0] } as any;
                    try { if (campaign.platform && typeof campaign.platform === 'string') campaign.platform = JSON.parse(campaign.platform); } catch (e) { console.warn(`[GET ID ${id}] Erro parse platform: ${e}`); campaign.platform = null; }
                    try { if (campaign.objective && typeof campaign.objective === 'string') campaign.objective = JSON.parse(campaign.objective); } catch (e) { console.warn(`[GET ID ${id}] Erro parse objective: ${e}`); campaign.objective = null; }
                    try { if (campaign.adFormat && typeof campaign.adFormat === 'string') campaign.adFormat = JSON.parse(campaign.adFormat); } catch (e) { console.warn(`[GET ID ${id}] Erro parse adFormat: ${e}`); campaign.adFormat = null; }
                    res.status(200).json(campaign as CampaignResponse);
                } else {
                    console.log(`[API Campaigns GET ID] Campanha ID ${id} não encontrada.`);
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                console.log("[API Campaigns GET List] Listando campanhas...");
                const allowedFields = ['id', 'user_id', 'name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'targetAudience', 'segmentation', 'adFormat', 'avgTicket', 'purchaseFrequency', 'customerLifespan', 'status', 'startDate', 'endDate', 'cost_traffic', 'cost_creative', 'cost_operational', 'created_at', 'updated_at'];
                let selectFields = '*';

                if (fields && typeof fields === 'string') {
                    const requestedFields = fields.split(',').map(f => f.trim()).filter(f => allowedFields.includes(f));
                    if (requestedFields.length > 0) { selectFields = requestedFields.map(f => dbConnection!.escapeId(f)).join(', '); }
                }

                let query = `SELECT ${selectFields} FROM campaigns`;
                const queryParams: any[] = [];
                const whereClauses: string[] = [];

                if (user_id && typeof user_id === 'string') {
                    whereClauses.push('user_id = ?');
                    queryParams.push(parseInt(user_id, 10));
                }
                // Adicione outros filtros aqui se necessário

                if (whereClauses.length > 0) {
                    query += ` WHERE ${whereClauses.join(' AND ')}`;
                }

                if (sort && typeof sort === 'string') {
                    const [sortField, sortOrder = 'asc'] = sort.split(':');
                    if (allowedFields.includes(sortField) && ['asc', 'desc'].includes(sortOrder.toLowerCase())) { query += ` ORDER BY ${dbConnection!.escapeId(sortField)} ${sortOrder.toUpperCase()}`; }
                    else { query += ` ORDER BY created_at DESC`; }
                } else { query += ` ORDER BY created_at DESC`; }

                const defaultLimit = 50;
                let limitNum = defaultLimit;
                if (limit && typeof limit === 'string' && /^\d+$/.test(limit)) {
                    const requestedLimit = parseInt(limit, 10);
                    if (requestedLimit > 0) limitNum = requestedLimit;
                }
                query += ` LIMIT ${limitNum}`;

                console.log(`[API Campaigns GET List] Executing Query: ${query} with params: ${JSON.stringify(queryParams)}`);
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(query, queryParams);

                const campaigns = rows.map(campaign => {
                    let tempCampaign = { ...campaign } as any;
                    try { if (tempCampaign.platform && typeof tempCampaign.platform === 'string') tempCampaign.platform = JSON.parse(tempCampaign.platform); } catch (e) { console.warn(`[GET List] Erro parse platform ID ${tempCampaign.id}: ${e}`); tempCampaign.platform = null;}
                    try { if (tempCampaign.objective && typeof tempCampaign.objective === 'string') tempCampaign.objective = JSON.parse(tempCampaign.objective); } catch (e) { console.warn(`[GET List] Erro parse objective ID ${tempCampaign.id}: ${e}`); tempCampaign.objective = null;}
                    try { if (tempCampaign.adFormat && typeof tempCampaign.adFormat === 'string') tempCampaign.adFormat = JSON.parse(tempCampaign.adFormat); } catch (e) { console.warn(`[GET List] Erro parse adFormat ID ${tempCampaign.id}: ${e}`); tempCampaign.adFormat = null;}
                    return tempCampaign;
                });
                res.status(200).json(campaigns as CampaignResponse[]);
            }
        }
        else if (req.method === 'POST') {
            console.log("[API Campaigns POST] Requisição recebida.");
            const campaignInput: CampaignInput = req.body;
            console.log("[API Campaigns POST] Dados recebidos no body:", campaignInput);

            if (!campaignInput.name || typeof campaignInput.name !== 'string' || campaignInput.name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }

            const id = crypto.randomUUID();
            const platformJson = (campaignInput.platform && Array.isArray(campaignInput.platform)) ? JSON.stringify(campaignInput.platform) : (typeof campaignInput.platform === 'string' ? campaignInput.platform : null);
            const objectiveJson = (campaignInput.objective && Array.isArray(campaignInput.objective)) ? JSON.stringify(campaignInput.objective) : (typeof campaignInput.objective === 'string' ? campaignInput.objective : null);
            const adFormatJson = (campaignInput.adFormat && Array.isArray(campaignInput.adFormat)) ? JSON.stringify(campaignInput.adFormat) : (typeof campaignInput.adFormat === 'string' ? campaignInput.adFormat : null);

            const sql = `
                INSERT INTO campaigns (
                    id, name, user_id, platform, objective, budget, daily_budget, duration, industry,
                    targetAudience, segmentation, adFormat, avgTicket, purchaseFrequency, customerLifespan, 
                    status, startDate, endDate, cost_traffic, cost_creative, cost_operational
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id, campaignInput.name.trim(), campaignInput.user_id ?? null,
                platformJson, objectiveJson,
                campaignInput.budget != null && String(campaignInput.budget) !== '' ? Number(campaignInput.budget) : null,
                campaignInput.daily_budget != null && String(campaignInput.daily_budget) !== '' ? Number(campaignInput.daily_budget) : null,
                campaignInput.duration != null && String(campaignInput.duration) !== '' ? Number(campaignInput.duration) : null,
                campaignInput.industry ?? null, campaignInput.targetAudience ?? null, campaignInput.segmentation ?? null,
                adFormatJson,
                campaignInput.avgTicket ?? null, campaignInput.purchaseFrequency ?? null, campaignInput.customerLifespan ?? null,
                campaignInput.status ?? 'draft',
                campaignInput.startDate ? new Date(campaignInput.startDate).toISOString().slice(0, 10) : null,
                campaignInput.endDate ? new Date(campaignInput.endDate).toISOString().slice(0, 10) : null,
                campaignInput.cost_traffic != null && String(campaignInput.cost_traffic) !== '' ? Number(campaignInput.cost_traffic) : 0.00,
                campaignInput.cost_creative != null && String(campaignInput.cost_creative) !== '' ? Number(campaignInput.cost_creative) : 0.00,
                campaignInput.cost_operational != null && String(campaignInput.cost_operational) !== '' ? Number(campaignInput.cost_operational) : 0.00
            ];

            console.log("[API Campaigns POST] SQL Query:", sql.substring(0, 300) + "...");
            console.log("[API Campaigns POST] Params:", JSON.stringify(params).substring(0,300) + "...");

            await dbConnection.query(sql, params);
            console.log("[API Campaigns POST] INSERT executado com sucesso. ID:", id);

            const [newCampaignRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
            if (newCampaignRows.length > 0) {
                const newCampaign = { ...newCampaignRows[0] } as any;
                try { if (newCampaign.platform && typeof newCampaign.platform === 'string') newCampaign.platform = JSON.parse(newCampaign.platform); } catch(e){}
                try { if (newCampaign.objective && typeof newCampaign.objective === 'string') newCampaign.objective = JSON.parse(newCampaign.objective); } catch(e){}
                try { if (newCampaign.adFormat && typeof newCampaign.adFormat === 'string') newCampaign.adFormat = JSON.parse(newCampaign.adFormat); } catch(e){}
                res.status(201).json(newCampaign as CampaignResponse);
            } else {
                res.status(500).json({ message: "Erro ao buscar campanha recém-criada" });
            }
        }
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const updateData: Partial<CampaignInput> = req.body;

            if (!id || typeof id !== 'string') {
                return res.status(400).json({ message: 'ID da campanha é obrigatório na query string' });
            }
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }
            
            const fieldsToUpdate: string[] = [];
            const params: any[] = [];

            Object.entries(updateData).forEach(([key, value]) => {
                if (value !== undefined && ['name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'targetAudience', 'segmentation', 'adFormat', 'avgTicket', 'purchaseFrequency', 'customerLifespan', 'status', 'startDate', 'endDate', 'cost_traffic', 'cost_creative', 'cost_operational', 'user_id'].includes(key)) {
                    fieldsToUpdate.push(`${dbConnection!.escapeId(key)} = ?`);
                    if (['platform', 'objective', 'adFormat'].includes(key)) {
                        params.push((value && Array.isArray(value)) ? JSON.stringify(value) : (typeof value === 'string' ? value : null));
                    } else if (['startDate', 'endDate'].includes(key) && value) {
                        params.push(new Date(value as string).toISOString().slice(0, 10));
                    } else if (value === null || String(value).trim() === '') {
                         params.push(null);
                    } else if (typeof value === 'string' && ['budget', 'daily_budget', 'duration', 'avgTicket', 'purchaseFrequency', 'customerLifespan', 'cost_traffic', 'cost_creative', 'cost_operational'].includes(key)) {
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
                const updatedCampaign = { ...updatedCampaignRows[0] } as any;
                try { if (updatedCampaign.platform && typeof updatedCampaign.platform === 'string') updatedCampaign.platform = JSON.parse(updatedCampaign.platform); } catch(e){}
                try { if (updatedCampaign.objective && typeof updatedCampaign.objective === 'string') updatedCampaign.objective = JSON.parse(updatedCampaign.objective); } catch(e){}
                try { if (updatedCampaign.adFormat && typeof updatedCampaign.adFormat === 'string') updatedCampaign.adFormat = JSON.parse(updatedCampaign.adFormat); } catch(e){}
                res.status(200).json(updatedCampaign as CampaignResponse);
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
            // Adicionar aqui a deleção de registros dependentes (ex: daily_metrics, copies) ANTES de deletar a campanha, se a FK não for ON DELETE CASCADE
            // await dbConnection.query('DELETE FROM daily_metrics WHERE campaign_id = ?', [id]);
            // await dbConnection.query('DELETE FROM copies WHERE campaign_id = ?', [id]);
            // ... e outras tabelas ...

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
