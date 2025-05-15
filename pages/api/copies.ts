// pages/api/copies.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db-mysql'; // Removidas initializeCopiesTable e initializeCampaignsTable da importação
import mysql from 'mysql2/promise';

// Interface para os dados de uma "Copy" - Alinhada com o schema de initializeCopiesTable
interface CopyData {
    id: string; // UUID gerado no backend
    campaign_id?: string | null;
    creative_id?: string | null;
    user_id?: number | null;
    title: string;
    content_body: string; // Nome corrigido
    caption?: string | null;
    cta?: string | null;
    target_audience?: string | null;
    copy_type?: 'headline' | 'body' | 'cta' | 'description' | 'ad_copy' | 'email_subject' | 'social_post' | 'other'; // Nome corrigido
    status?: 'active' | 'inactive' | 'draft' | 'archived' | 'approved' | 'rejected';
    clicks?: number;
    impressions?: number;
    conversions?: number;
    created_at?: string; // Gerado pelo DB
    updated_at?: string; // Gerado pelo DB
}

// Interface para o que o frontend envia (sem id, created_at, updated_at)
interface CopyInputData {
    campaign_id?: string | null;
    creative_id?: string | null;
    user_id?: number | null; // Assumindo que o frontend pode enviar isso
    title: string;
    content_body: string;
    caption?: string | null;
    cta?: string | null;
    target_audience?: string | null;
    copy_type?: CopyData['copy_type'];
    status?: CopyData['status'];
    clicks?: number; // Geralmente não são definidos na criação/update manual, mas sim por métricas
    impressions?: number;
    conversions?: number;
}


type ApiResponse =
    | CopyData[]
    | CopyData
    | { message: string; error?: string; details?: any; code?: string }
    | { message: string; id?: string; changes?: number }; // id é string (UUID)


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    let dbConnection: mysql.PoolConnection | null = null;
    try {
        const dbPool = getDbPool();
        if (!dbPool) {
            console.error("[API Copies] Falha crítica: Pool de conexão MySQL não disponível.");
            return res.status(503).json({ message: "Serviço de banco de dados indisponível.", error: "DB_POOL_UNAVAILABLE" });
        }
        
        // Assumimos que initializeAllTables() já foi chamado na inicialização do servidor.
        // Não chamamos initializeCopiesTable() ou initializeCampaignsTable() aqui para evitar redundância.

        dbConnection = await dbPool.getConnection();
        console.debug(`[API Copies ${req.method}] Conexão com DB obtida.`);

        switch (req.method) {
            case 'GET':
                const { id: queryId, campaign_id: queryCampaignId, user_id: queryUserId, creative_id: queryCreativeId } = req.query;
                let getQuery = 'SELECT * FROM copies';
                const getParams: (string | number)[] = [];
                const conditions: string[] = [];

                if (queryId) {
                    conditions.push('id = ?');
                    getParams.push(queryId as string);
                }
                if (queryCampaignId) {
                    conditions.push('campaign_id = ?');
                    getParams.push(queryCampaignId as string);
                }
                if (queryCreativeId) {
                    conditions.push('creative_id = ?');
                    getParams.push(queryCreativeId as string);
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
                getQuery += ' ORDER BY created_at DESC';

                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(getQuery, getParams);
                const copies = rows.map(row => ({
                    ...row,
                    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
                    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
                })) as CopyData[];
                res.status(200).json(copies);
                break;

            case 'POST':
                await dbConnection.beginTransaction();
                const copyInput: CopyInputData = req.body;
                
                if (!copyInput.title || !copyInput.content_body) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Título e Corpo do Conteúdo (content_body) são obrigatórios." });
                }
                const newId = crypto.randomUUID();

                const insertQuery = `
                    INSERT INTO copies 
                    (id, campaign_id, creative_id, user_id, title, content_body, caption, cta, target_audience, copy_type, status, clicks, impressions, conversions) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                // created_at e updated_at são gerenciados pelo DB
                await dbConnection.query(insertQuery, [
                    newId,
                    copyInput.campaign_id || null,
                    copyInput.creative_id || null,
                    copyInput.user_id || null,
                    copyInput.title,
                    copyInput.content_body,
                    copyInput.caption || null,
                    copyInput.cta || null,
                    copyInput.target_audience || null,
                    copyInput.copy_type || 'other',
                    copyInput.status || 'draft',
                    copyInput.clicks || 0,
                    copyInput.impressions || 0,
                    copyInput.conversions || 0
                ]);
                
                const [newCopyRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM copies WHERE id = ?', [newId]);
                if (newCopyRows.length === 0) {
                    await dbConnection.rollback();
                    throw new Error("Falha ao buscar cópia recém-criada após inserção.");
                }
                await dbConnection.commit();
                const createdCopy = {
                    ...newCopyRows[0],
                    created_at: newCopyRows[0].created_at ? new Date(newCopyRows[0].created_at).toISOString() : undefined,
                    updated_at: newCopyRows[0].updated_at ? new Date(newCopyRows[0].updated_at).toISOString() : undefined,
                } as CopyData;
                res.status(201).json(createdCopy);
                break;

            case 'PUT':
                await dbConnection.beginTransaction();
                const { id: updateId } = req.query;
                const updateData: Partial<CopyInputData> = req.body;

                if (!updateId || typeof updateId !== 'string') {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "ID da copy é obrigatório para atualização." });
                }
                if (Object.keys(updateData).length === 0) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Nenhum dado fornecido para atualização." });
                }

                const allowedUpdateFields = ['campaign_id', 'creative_id', 'user_id', 'title', 'content_body', 'caption', 'cta', 'target_audience', 'copy_type', 'status', 'clicks', 'impressions', 'conversions'];
                const fieldsToUpdateSQL: string[] = [];
                const valuesToUpdate: any[] = [];

                for (const key of allowedUpdateFields) {
                    if (Object.prototype.hasOwnProperty.call(updateData, key)) { // Verifica se a chave existe no objeto
                        fieldsToUpdateSQL.push(`${dbConnection.escapeId(key)} = ?`);
                        const value = (updateData as any)[key];
                        // Trata string vazia como null para campos que permitem null
                        if (value === '' && ['campaign_id', 'creative_id', 'user_id', 'caption', 'cta', 'target_audience'].includes(key)) {
                            valuesToUpdate.push(null);
                        } else {
                            valuesToUpdate.push(value);
                        }
                    }
                }

                if (fieldsToUpdateSQL.length === 0) {
                    await dbConnection.rollback();
                     return res.status(400).json({ message: "Nenhum campo válido fornecido para atualização." });
                }
                
                valuesToUpdate.push(updateId);

                // updated_at será atualizado pelo DB (ON UPDATE CURRENT_TIMESTAMP)
                const updateQuery = `UPDATE copies SET ${fieldsToUpdateSQL.join(', ')} WHERE id = ?`;
                const [updateResult] = await dbConnection.query<mysql.ResultSetHeader>(updateQuery, valuesToUpdate);

                if (updateResult.affectedRows === 0) {
                     const [checkRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT id FROM copies WHERE id = ?', [updateId]);
                     await dbConnection.rollback(); // Rollback antes de retornar
                     if (checkRows.length === 0) {
                        return res.status(404).json({ message: `Copy com ID ${updateId} não encontrada.` });
                     }
                     return res.status(200).json({ message: `Nenhum dado alterado para a copy ${updateId}.`, id: updateId as string, changes: 0 });
                }

                const [updatedCopyRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM copies WHERE id = ?', [updateId]);
                await dbConnection.commit();
                 if (updatedCopyRows.length === 0) { // Checagem de segurança
                    return res.status(404).json({ message: 'Cópia não encontrada após uma atualização que indicou sucesso.' });
                }
                const updatedCopy = {
                    ...updatedCopyRows[0],
                    created_at: updatedCopyRows[0].created_at ? new Date(updatedCopyRows[0].created_at).toISOString() : undefined,
                    updated_at: updatedCopyRows[0].updated_at ? new Date(updatedCopyRows[0].updated_at).toISOString() : undefined,
                } as CopyData;
                res.status(200).json(updatedCopy);
                break;

            case 'DELETE':
                await dbConnection.beginTransaction();
                const { id: deleteId } = req.query;
                if (!deleteId || typeof deleteId !== 'string') {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "ID da copy é obrigatório para deleção." });
                }
                const [deleteResult] = await dbConnection.query<mysql.ResultSetHeader>('DELETE FROM copies WHERE id = ?', [deleteId]);
                if (deleteResult.affectedRows === 0) {
                    await dbConnection.rollback();
                    return res.status(404).json({ message: `Copy com ID ${deleteId} não encontrada.` });
                }
                await dbConnection.commit();
                res.status(200).json({ message: `Copy ${deleteId} deletada com sucesso.`, id: deleteId as string, changes: deleteResult.affectedRows });
                break;

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                res.status(405).json({ message: `Método ${req.method} não permitido` });
                break;
        }

    } catch (error: any) {
        if (dbConnection) {
            try { await dbConnection.rollback(); console.debug(`[API Copies ${req?.method}] Transação rollbackada devido a erro.`);}
            catch (rbError) { console.error("[API Copies] Erro no rollback:", rbError); }
        }
        console.error(`[API Copies ${req?.method}] Erro:`, error);
        res.status(500).json({
            message: error.message || 'Erro interno do servidor ao processar copies.',
            error: error.code || 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' && error.sqlMessage ? `SQL Error ${error.errno} (${error.sqlState}): ${error.sqlMessage}` : (process.env.NODE_ENV === 'development' ? error.stack : undefined)
        });
    } finally {
        if (dbConnection) {
            dbConnection.release();
            console.debug(`[API Copies ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
