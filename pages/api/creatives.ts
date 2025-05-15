// pages/api/creatives.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import path from 'path'; // ADICIONADO
import fs from 'fs/promises'; // ADICIONADO

// Interface para os dados de um "Creative" - Alinhada com o schema de initializeCreativesTable
interface CreativeData {
    id: string; // UUID
    campaign_id?: string | null;
    user_id?: number | null;
    name: string;
    type?: 'image' | 'video' | 'text' | 'carousel' | 'headline' | 'body' | 'cta' | 'other';
    file_url?: string | null;
    content?: string | null; // Pode ser JSON para carrossel, ou texto para ad copy, ou caminho do arquivo
    metrics?: any | null;    // JSON para métricas específicas do criativo
    status?: 'active' | 'inactive' | 'draft' | 'archived';
    publish_date?: string | null; 
    originalFilename?: string | null; 
    comments?: string | null; 
    format?: string | null; 
    platform?: string[] | string | null; 
    created_at?: string; // Gerado pelo DB
    updated_at?: string; // Gerado pelo DB
}

interface CreativeInputData {
    campaign_id?: string | null;
    user_id?: number | null;
    name: string;
    type?: CreativeData['type'];
    file_url?: string | null;
    content?: string | null;
    metrics?: any | null;
    status?: CreativeData['status'];
    publish_date?: string | null;
    originalFilename?: string | null;
    comments?: string | null;
    format?: string | null;
    platform?: string[] | string | null;
}

type ApiResponse =
    | CreativeData[]
    | CreativeData
    | { message: string; error?: string; details?: any; code?: string }
    | { message: string; id?: string; changes?: number };


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    let dbConnection: mysql.PoolConnection | null = null;
    try {
        const dbPool = getDbPool();
        if (!dbPool) {
            console.error("[API Creatives] Falha crítica: Pool de conexão MySQL não disponível.");
            return res.status(503).json({ message: "Serviço de banco de dados indisponível.", error: "DB_POOL_UNAVAILABLE" });
        }
        
        dbConnection = await dbPool.getConnection();
        console.debug(`[API Creatives ${req.method}] Conexão com DB obtida.`);

        switch (req.method) {
            case 'GET':
                const { id: queryId, campaign_id: queryCampaignId, user_id: queryUserId } = req.query;
                let getQuery = 'SELECT * FROM creatives';
                const getParams: (string | number)[] = [];
                const conditions: string[] = [];

                if (queryId) {
                    conditions.push('id = ?');
                    getParams.push(queryId as string);
                }
                if (queryCampaignId) {
                    if (queryCampaignId === 'none' || queryCampaignId === 'null') {
                        conditions.push('campaign_id IS NULL');
                    } else {
                        conditions.push('campaign_id = ?');
                        getParams.push(queryCampaignId as string);
                    }
                }
                 if (queryUserId) {
                    const userIdNum = parseInt(queryUserId as string, 10);
                    if (!isNaN(userIdNum)) {
                        conditions.push('user_id = ?');
                        getParams.push(userIdNum);
                    }
                }

                if (conditions.length > 0) {
                    getQuery += ' WHERE ' + conditions.join(' AND ');
                }
                getQuery += ' ORDER BY created_at DESC, name ASC';

                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(getQuery, getParams);
                const creatives = rows.map(row => {
                    let platformData = null;
                    if (row.platform && typeof row.platform === 'string') {
                        try { platformData = JSON.parse(row.platform); }
                        catch (e) { console.warn(`[API Creatives GET] Falha ao parsear platform JSON para ID ${row.id}`); }
                    } else if (Array.isArray(row.platform)) {
                        platformData = row.platform;
                    }
                    return {
                        ...row,
                        metrics: row.metrics && typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics || null),
                        platform: platformData,
                        created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
                        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
                    };
                }) as CreativeData[];
                res.status(200).json(creatives);
                break;

            case 'POST':
                await dbConnection.beginTransaction();
                const creativeInput: CreativeInputData = req.body;
                
                if (!creativeInput.name || !creativeInput.type) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Nome e Tipo do criativo são obrigatórios." });
                }
                const newId = crypto.randomUUID();
                const platformJson = Array.isArray(creativeInput.platform) ? JSON.stringify(creativeInput.platform) : typeof creativeInput.platform === 'string' ? creativeInput.platform : null;
                let publishDateIso: string | null = null;
                if (creativeInput.publish_date) {
                    try { publishDateIso = new Date(creativeInput.publish_date).toISOString().slice(0, 19).replace('T', ' '); }
                    catch (dateError) { console.warn("Data de publicação inválida no POST:", creativeInput.publish_date); }
                }

                const insertQuery = `
                    INSERT INTO creatives 
                    (id, campaign_id, user_id, name, type, file_url, content, metrics, status, platform, format, publish_date, originalFilename, comments) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await dbConnection.query(insertQuery, [
                    newId,
                    creativeInput.campaign_id || null,
                    creativeInput.user_id || null,
                    creativeInput.name,
                    creativeInput.type || 'other',
                    creativeInput.file_url || null,
                    creativeInput.content || null,
                    creativeInput.metrics ? JSON.stringify(creativeInput.metrics) : null,
                    creativeInput.status || 'draft',
                    platformJson,
                    creativeInput.format || null,
                    publishDateIso,
                    creativeInput.originalFilename || null,
                    creativeInput.comments || null
                ]);
                
                const [newCreativeRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM creatives WHERE id = ?', [newId]);
                if (newCreativeRows.length === 0) {
                    await dbConnection.rollback();
                    throw new Error("Falha ao buscar criativo recém-criado após inserção.");
                }
                await dbConnection.commit();
                let createdPlatformData = null;
                if (newCreativeRows[0].platform && typeof newCreativeRows[0].platform === 'string') {
                    try { createdPlatformData = JSON.parse(newCreativeRows[0].platform); } catch(e) {}
                } else if (Array.isArray(newCreativeRows[0].platform)) {
                    createdPlatformData = newCreativeRows[0].platform;
                }
                const createdCreative = {
                    ...newCreativeRows[0],
                    metrics: newCreativeRows[0].metrics && typeof newCreativeRows[0].metrics === 'string' ? JSON.parse(newCreativeRows[0].metrics) : (newCreativeRows[0].metrics || null),
                    platform: createdPlatformData,
                    created_at: newCreativeRows[0].created_at ? new Date(newCreativeRows[0].created_at).toISOString() : undefined,
                    updated_at: newCreativeRows[0].updated_at ? new Date(newCreativeRows[0].updated_at).toISOString() : undefined,
                } as CreativeData;
                res.status(201).json(createdCreative);
                break;
            
            case 'PUT':
                await dbConnection.beginTransaction();
                const { id: updateId } = req.query;
                const updateData: Partial<CreativeInputData> = req.body;

                if (!updateId || typeof updateId !== 'string') {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "ID do criativo é obrigatório para atualização." });
                }
                if (Object.keys(updateData).length === 0) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Nenhum dado fornecido para atualização." });
                }

                const allowedUpdateFields = ['campaign_id', 'user_id', 'name', 'type', 'file_url', 'content', 'metrics', 'status', 'platform', 'format', 'publish_date', 'originalFilename', 'comments'];
                const fieldsToUpdateSQL: string[] = [];
                const valuesToUpdate: any[] = [];

                for (const key of allowedUpdateFields) {
                    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
                        fieldsToUpdateSQL.push(`${dbConnection.escapeId(key)} = ?`);
                        let value = (updateData as any)[key];
                        if ((key === 'metrics' || key === 'platform') && value !== null && value !== undefined) {
                            value = JSON.stringify(value);
                        } else if (key === 'publish_date' && value !== null && value !== undefined && value !== '') { 
                            try { value = new Date(value).toISOString().slice(0, 19).replace('T', ' '); }
                            catch(dateError){ value = null; console.warn(`Data de publicação inválida no PUT para ${key}: ${value}`);}
                        }
                        if (value === '' && ['campaign_id', 'file_url', 'content', 'comments', 'format', 'originalFilename', 'publish_date'].includes(key)) {
                            valuesToUpdate.push(null);
                        } else if (key === 'user_id' && (value === '' || value === null || value === undefined)) {
                             valuesToUpdate.push(null);
                        }
                        else {
                            valuesToUpdate.push(value);
                        }
                    }
                }
                
                if (fieldsToUpdateSQL.length === 0) {
                     await dbConnection.rollback();
                     return res.status(400).json({ message: "Nenhum campo válido fornecido para atualização." });
                }

                valuesToUpdate.push(updateId);
                const updateQuery = `UPDATE creatives SET ${fieldsToUpdateSQL.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
                const [updateResult] = await dbConnection.query<mysql.ResultSetHeader>(updateQuery, valuesToUpdate);

                if (updateResult.affectedRows === 0) {
                    const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM creatives WHERE id = ?', [updateId]);
                    await dbConnection.rollback();
                    if (checkRows.length === 0) {
                       return res.status(404).json({ message: `Criativo com ID ${updateId} não encontrado.` });
                    }
                    console.log(`[API Creatives PUT] Nenhuma linha afetada para criativo ${updateId}, mas criativo existe. Dados podem ser os mesmos.`);
                    const [currentCreativeRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM creatives WHERE id = ?', [updateId]);
                    if (currentCreativeRows.length > 0) {
                        let currentPlatformData = null;
                        if (currentCreativeRows[0].platform && typeof currentCreativeRows[0].platform === 'string') { try { currentPlatformData = JSON.parse(currentCreativeRows[0].platform); } catch(e) {} }
                        else if (Array.isArray(currentCreativeRows[0].platform)) { currentPlatformData = currentCreativeRows[0].platform; }
                        
                        const currentCreative = {
                            ...currentCreativeRows[0],
                            metrics: currentCreativeRows[0].metrics && typeof currentCreativeRows[0].metrics === 'string' ? JSON.parse(currentCreativeRows[0].metrics) : (currentCreativeRows[0].metrics || null),
                            platform: currentPlatformData,
                            created_at: currentCreativeRows[0].created_at ? new Date(currentCreativeRows[0].created_at).toISOString() : undefined,
                            updated_at: currentCreativeRows[0].updated_at ? new Date(currentCreativeRows[0].updated_at).toISOString() : undefined,
                        } as CreativeData;
                        return res.status(200).json(currentCreative);
                    }
                    return res.status(404).json({ message: `Criativo com ID ${updateId} não encontrado.` });
                }

                const [updatedCreativeRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM creatives WHERE id = ?', [updateId]);
                await dbConnection.commit();
                 if (updatedCreativeRows.length === 0) {
                   return res.status(404).json({ message: 'Criativo não encontrado após uma atualização que indicou sucesso.' });
                }
                let updatedPlatformData = null;
                if (updatedCreativeRows[0].platform && typeof updatedCreativeRows[0].platform === 'string') {
                    try { updatedPlatformData = JSON.parse(updatedCreativeRows[0].platform); } catch(e) {}
                } else if (Array.isArray(updatedCreativeRows[0].platform)) {
                    updatedPlatformData = updatedCreativeRows[0].platform;
                }
                const updatedCreative = {
                    ...updatedCreativeRows[0],
                    metrics: updatedCreativeRows[0].metrics && typeof updatedCreativeRows[0].metrics === 'string' ? JSON.parse(updatedCreativeRows[0].metrics) : (updatedCreativeRows[0].metrics || null),
                    platform: updatedPlatformData,
                    created_at: updatedCreativeRows[0].created_at ? new Date(updatedCreativeRows[0].created_at).toISOString() : undefined,
                    updated_at: updatedCreativeRows[0].updated_at ? new Date(updatedCreativeRows[0].updated_at).toISOString() : undefined,
                } as CreativeData;
                res.status(200).json(updatedCreative);
                break;

            case 'DELETE':
                await dbConnection.beginTransaction();
                const { id: deleteId } = req.query;
                if (!deleteId || typeof deleteId !== 'string') {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "ID do criativo é obrigatório para deleção." });
                }
                
                const [creativeToDeleteRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT content FROM creatives WHERE id = ?', [deleteId]);
                const deleteResult = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM creatives WHERE id = ?', [deleteId]);

                if (deleteResult[0].affectedRows === 0) {
                    await dbConnection.rollback();
                    return res.status(404).json({ message: `Criativo com ID ${deleteId} não encontrado.` });
                }
                
                if (creativeToDeleteRows.length > 0 && creativeToDeleteRows[0].content && typeof creativeToDeleteRows[0].content === 'string' && creativeToDeleteRows[0].content.startsWith('/uploads/')) {
                    const UPLOAD_DIR_PHYSICAL = path.join(process.cwd(), 'uploads');
                    const physicalFilePath = path.join(UPLOAD_DIR_PHYSICAL, path.basename(creativeToDeleteRows[0].content));
                    try {
                        await fs.unlink(physicalFilePath);
                        console.log(`[API Creatives DELETE] Arquivo físico ${physicalFilePath} deletado.`);
                    } catch (fileError: any) {
                        console.warn(`[API Creatives DELETE] Falha ao deletar arquivo físico ${physicalFilePath}:`, fileError.message);
                    }
                }

                await dbConnection.commit();
                res.status(200).json({ message: `Criativo ${deleteId} deletado com sucesso.`, id: deleteId as string, changes: deleteResult[0].affectedRows });
                break;

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                res.status(405).json({ message: `Método ${req.method} não permitido` });
                break;
        }

    } catch (error: any) {
        if (dbConnection) {
            try { await dbConnection.rollback(); console.debug(`[API Creatives ${req?.method}] Transação rollbackada devido a erro.`);}
            catch (rbError) { console.error("[API Creatives] Erro no rollback:", rbError); }
        }
        console.error(`[API Creatives ${req?.method}] Erro:`, error);
        res.status(500).json({
            message: error.message || 'Erro interno do servidor ao processar criativos.',
            error: error.code || 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' && error.sqlMessage ? `SQL Error ${error.errno} (${error.sqlState}): ${error.sqlMessage}` : (process.env.NODE_ENV === 'development' ? error.stack : undefined)
        });
    } finally {
        if (dbConnection) {
            dbConnection.release();
            console.debug(`[API Creatives ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
