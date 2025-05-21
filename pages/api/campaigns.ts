// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
// import { verifyToken } from '@/lib/auth'; // Descomente para autenticação real

// --- Interfaces (como definidas anteriormente, incluindo os novos campos) ---
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
    segmentation_notes?: string | null;
    avg_ticket?: number | string | null;
    external_campaign_id?: string | null;
    user_id?: number | null;
    // Mapeamento CamelCase
    selectedclientaccountid?: string | null;
    dailyBudget?: number | string | null;
    startDate?: string | null;
    endDate?: string | null;
    targetAudienceDescription?: string | null;
    avgTicket?: number | string | null;
    externalCampaignId?: string | null;
    segmentationNotes?: string | null;
}

interface CampaignDbRecord {
    id: string;
    user_id: number;
    name: string;
    status: string;
    selected_client_account_id?: string | null;
    external_platform_account_id?: string | null; 
    platform_source?: string | null;
    external_campaign_id?: string | null;
    platforms?: string | null; 
    objectives?: string | null; 
    ad_formats?: string | null; 
    budget?: number | null;
    daily_budget?: number | null;
    start_date?: string | null; 
    end_date?: string | null;   
    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null;
    avg_ticket?: number | null;
    client_name?: string | null; 
    product_name?: string | null;
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;
    duration?: number | null;
    purchase_frequency?: number | null;
    customer_lifespan?: number | null;
    created_at: string;
    updated_at: string;
}

interface CampaignResponse {
    id: string;
    name: string;
    status: string;
    selectedClientAccountId?: string | null;
    externalPlatformAccountId?: string | null;
    platformSource?: string | null;
    externalCampaignId?: string | null;
    platforms?: string[] | null;
    objectives?: string[] | null;
    ad_formats?: string[] | null;
    budget?: number | null;
    dailyBudget?: number | null;
    startDate?: string | null; 
    endDate?: string | null;   
    targetAudienceDescription?: string | null;
    industry?: string | null;
    segmentationNotes?: string | null;
    avgTicket?: number | null;
    clientName?: string | null;
    productName?: string | null;
    costTraffic?: number | null;
    costCreative?: number | null;
    costOperational?: number | null;
    duration?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    created_at: string;
    updated_at: string;
    user_id?: number;
}

// --- Helpers (toSnakeCase, CampaignDbRecordExample, campaignDbSchemaKeys - como antes) ---
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

class CampaignDbRecordExample implements Partial<CampaignDbRecord> {
    id?: any; user_id?: any; name?: any; status?: any; selected_client_account_id?: any;
    external_platform_account_id?: any; platform_source?: any; external_campaign_id?: any;
    platforms?: any; objectives?: any; ad_formats?: any; budget?: any; daily_budget?: any;
    start_date?: any; end_date?: any; target_audience_description?: any; industry?: any;
    segmentation_notes?: any; avg_ticket?: any; client_name?: any; product_name?: any;
    cost_traffic?: any; cost_creative?: any; cost_operational?: any; duration?: any;
    purchase_frequency?: any; customer_lifespan?: any; created_at?: any; updated_at?: any;
}
const campaignDbSchemaKeys = Object.keys(new CampaignDbRecordExample());


const mapInputToDbFields = (input: CampaignInput): Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> => {
    const dbFields: Partial<Omit<CampaignDbRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {};
    const inputProcessed = { ...input };

    const camelToSnakeMapping: { [key: string]: keyof CampaignDbRecord } = {
        selectedClientAccountId: 'selected_client_account_id',
        externalPlatformAccountId: 'external_platform_account_id',
        platformSource: 'platform_source',
        externalCampaignId: 'external_campaign_id',
        dailyBudget: 'daily_budget',
        startDate: 'start_date',
        endDate: 'end_date',
        targetAudienceDescription: 'target_audience_description',
        segmentationNotes: 'segmentation_notes',
        avgTicket: 'avg_ticket',
        clientName: 'client_name',
        productName: 'product_name',
        costTraffic: 'cost_traffic',
        costCreative: 'cost_creative',
        costOperational: 'cost_operational',
    };

    for (const camelKey in camelToSnakeMapping) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, camelKey)) {
            const snakeKey = camelToSnakeMapping[camelKey as keyof typeof camelToSnakeMapping];
            if (inputProcessed[camelKey as keyof CampaignInput] !== undefined) {
                 (dbFields as any)[snakeKey] = (inputProcessed as any)[camelKey];
            }
            delete (inputProcessed as any)[camelKey];
        }
    }
    
    for (const key in inputProcessed) {
        if (Object.prototype.hasOwnProperty.call(inputProcessed, key)) {
            const value = (inputProcessed as any)[key];
            const snakeKey = campaignDbSchemaKeys.includes(key) ? key as keyof CampaignDbRecord : toSnakeCase(key) as keyof CampaignDbRecord;

            if (campaignDbSchemaKeys.includes(snakeKey)) {
                if (['platforms', 'objectives', 'ad_formats'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = Array.isArray(value) && value.length > 0 ? JSON.stringify(value) : null;
                } else if (['start_date', 'end_date'].includes(snakeKey) && value) {
                    try {
                        (dbFields as any)[snakeKey] = new Date(value as string).toISOString().slice(0, 10);
                    } catch { (dbFields as any)[snakeKey] = null; }
                } else if (['budget', 'daily_budget', 'avg_ticket', 'cost_traffic', 'cost_creative', 'cost_operational', 'duration', 'purchase_frequency', 'customer_lifespan'].includes(snakeKey)) {
                    (dbFields as any)[snakeKey] = (value !== null && value !== undefined && String(value).trim() !== "") ? Number(value) : null;
                } else if (value === undefined || (typeof value === 'string' && value.trim() === '' && !['name', 'industry', 'status', 'target_audience_description', 'segmentation_notes', 'external_campaign_id', 'selected_client_account_id', 'external_platform_account_id', 'platform_source', 'client_name', 'product_name'].includes(snakeKey))) {
                     (dbFields as any)[snakeKey] = null;
                }
                else {
                    (dbFields as any)[snakeKey] = value;
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
        external_platform_account_id,
        platform_source,
        external_campaign_id,
        daily_budget,
        start_date,
        end_date,
        target_audience_description,
        segmentation_notes,
        avg_ticket,
        client_name,
        product_name,
        cost_traffic,
        cost_creative,
        cost_operational,
        duration,
        purchase_frequency,
        customer_lifespan,
        user_id,
        ...restOfDbRecord 
    } = dbRecord;

    return {
        ...restOfDbRecord,
        user_id: user_id,
        selectedClientAccountId: selected_client_account_id || null,
        externalPlatformAccountId: external_platform_account_id || null,
        platformSource: platform_source || null,
        externalCampaignId: external_campaign_id || null,
        platforms: dbPlatforms ? JSON.parse(dbPlatforms) : [],
        objectives: dbObjectives ? JSON.parse(dbObjectives) : [],
        ad_formats: dbAdFormats ? JSON.parse(dbAdFormats) : [],
        dailyBudget: daily_budget || null,
        startDate: start_date ? new Date(start_date).toISOString() : null,
        endDate: end_date ? new Date(end_date).toISOString() : null,
        targetAudienceDescription: target_audience_description || null,
        segmentationNotes: segmentation_notes || null,
        avgTicket: avg_ticket || null,
        clientName: client_name || null,
        productName: product_name || null,
        costTraffic: cost_traffic || null,
        costCreative: cost_creative || null,
        costOperational: cost_operational || null,
        duration: duration || null,
        purchaseFrequency: purchase_frequency || null,
        customerLifespan: customer_lifespan || null,
    };
};
// --- FIM dos Helpers ---

export default async function handler(req: NextApiRequest, res: NextApiResponse<CampaignResponse | CampaignResponse[] | { message: string } | { error: string }>) {
    console.log(`[API Campaigns Handler] Method: ${req.method}, URL: ${req.url}`);
    let dbConnection: mysql.PoolConnection | null = null;

    // --- AUTENTICAÇÃO (Exemplo, descomente e adapte sua lógica real) ---
    // const authUser = await verifyToken(req, res); // Sua função de verificar token
    // if (!authUser || typeof authUser.id !== 'number') {
    //   return res.status(401).json({ message: 'Autenticação requerida ou inválida.' });
    // }
    // const userId = authUser.id;
    const userId = 1; // <<<< REMOVER/SUBSTITUIR POR AUTENTICAÇÃO REAL
    console.log(`[API Campaigns] User ID (mock/real): ${userId}`);


    try {
        const dbPool = getDbPool();
        dbConnection = await dbPool.getConnection();

        if (req.method === 'GET') {
            const { id, status, selectedClientAccountId, search, sortBy, sortOrder, page, limit } = req.query;

            if (id && typeof id === 'string') {
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [id, userId]);
                if (rows.length > 0) {
                    res.status(200).json(parseDbRecordToResponse(rows[0] as CampaignDbRecord));
                } else {
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                // Listagem com Filtros, Ordenação e Paginação
                let baseQuery = 'FROM campaigns WHERE user_id = ?';
                const queryParams: any[] = [userId];
                
                let whereClauses: string[] = [];

                if (status && typeof status === 'string' && status !== 'all') {
                    whereClauses.push('status = ?');
                    queryParams.push(status);
                }
                if (selectedClientAccountId && typeof selectedClientAccountId === 'string' && selectedClientAccountId !== 'all') {
                    whereClauses.push('selected_client_account_id = ?');
                    queryParams.push(selectedClientAccountId);
                }
                if (search && typeof search === 'string' && search.trim() !== '') {
                    const searchTerm = `%${search.trim()}%`;
                    whereClauses.push('(name LIKE ? OR industry LIKE ? OR client_name LIKE ?)'); // Adapte os campos de busca
                    queryParams.push(searchTerm, searchTerm, searchTerm);
                }

                if (whereClauses.length > 0) {
                    baseQuery += ' AND ' + whereClauses.join(' AND ');
                }

                // Contagem para paginação (antes de adicionar ORDER BY e LIMIT para dados)
                const countSql = `SELECT COUNT(*) as total ${baseQuery}`;
                const [countRows] = await dbConnection.query<mysql.RowDataPacket[]>(countSql, queryParams);
                const totalItems = countRows[0].total || 0;

                // Ordenação
                const allowedSortColumns = ['name', 'status', 'created_at', 'start_date', 'daily_budget', 'budget'];
                let orderByClause = 'ORDER BY created_at DESC'; // Padrão
                if (sortBy && typeof sortBy === 'string' && allowedSortColumns.includes(sortBy)) {
                    const orderDirection = (typeof sortOrder === 'string' && sortOrder.toLowerCase() === 'desc') ? 'DESC' : 'ASC';
                    orderByClause = `ORDER BY ${dbConnection.escapeId(sortBy)} ${orderDirection}`;
                }
                
                // Paginação
                const currentPage = parseInt(page as string, 10) || 1;
                const itemsPerPage = parseInt(limit as string, 10) || 10; // Default 10 itens
                const offset = (currentPage - 1) * itemsPerPage;
                const paginationClause = `LIMIT ${itemsPerPage} OFFSET ${offset}`;

                const dataSql = `SELECT * ${baseQuery} ${orderByClause} ${paginationClause}`;
                const [dataRows] = await dbConnection.query<mysql.RowDataPacket[]>(dataSql, queryParams);
                
                res.status(200).json({
                    // @ts-ignore // Temporário para contornar incompatibilidade de tipo na resposta com paginação
                    data: dataRows.map(row => parseDbRecordToResponse(row as CampaignDbRecord)),
                    pagination: {
                        totalItems,
                        totalPages: Math.ceil(totalItems / itemsPerPage),
                        currentPage,
                        pageSize: itemsPerPage,
                    }
                });
            }
        }
        else if (req.method === 'POST') {
            // ... (lógica POST como antes, mas certifique-se que mapInputToDbFields e o INSERT SQL estão alinhados com CampaignDbRecord)
            const campaignRawInput: CampaignInput = req.body;
            if (!campaignRawInput.name?.trim()) return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            if (!campaignRawInput.selectedClientAccountId) return res.status(400).json({ error: 'Conta de Cliente Vinculada é obrigatória.' });
            if (!campaignRawInput.platform || campaignRawInput.platform.length === 0) return res.status(400).json({ error: 'Selecione ao menos uma plataforma.'});

            const campaignDbInput = mapInputToDbFields(campaignRawInput);
            const newCampaignId = crypto.randomUUID();

            const fieldsToInsert = ['id', 'user_id', ...Object.keys(campaignDbInput)];
            const placeholders = fieldsToInsert.map(() => '?').join(', ');
            
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
        }
        else if (req.method === 'PUT') {
            // ... (lógica PUT como antes, mas certifique-se que mapInputToDbFields e o UPDATE SQL estão alinhados)
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
        else if (req.method === 'DELETE') {
            // ... (lógica DELETE como antes) ...
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
            console.log(`[API Campaigns ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
