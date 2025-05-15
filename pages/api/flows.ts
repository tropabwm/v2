// pages/api/flows.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Adicionado initializeAllTables
import mysql from 'mysql2/promise';
import { FlowData, FlowElementData } from '@/types/zap';

interface FlowListItem extends Omit<FlowData, 'elements' | 'created_at'> {
    updated_at: string;
}

type ApiResponse =
    | FlowListItem[]
    | FlowData
    | { message: string; error?: string; details?: any; code?: string }
    | { message: string; id?: number; changes?: number };

// Flag para garantir que initializeAllTables seja chamado apenas uma vez por instância/worker do servidor
// Isso é uma otimização para evitar múltiplas chamadas desnecessárias se a API for muito requisitada.
// A flag 'tablesInitialized' dentro de initializeAllTables já previne múltiplas execuções das queries de schema.
let serverDbInitialized = false;

function safeParseJsonElements(jsonString: string | null | undefined): FlowElementData | null {
    if (jsonString === null || jsonString === undefined) return null;
    if (typeof jsonString === 'object' && jsonString !== null && Array.isArray((jsonString as FlowElementData).nodes) && Array.isArray((jsonString as FlowElementData).edges)) {
        return jsonString as FlowElementData;
    }
    if (typeof jsonString === 'string') {
        try {
            const parsed = JSON.parse(jsonString);
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                Array.isArray(parsed.nodes) &&
                Array.isArray(parsed.edges)
            ) {
                return {
                    nodes: parsed.nodes || [],
                    edges: parsed.edges || [],
                };
            }
            console.warn("[API Flows] SafeParseJsonElements: Estrutura JSON de 'elements' (string) inválida:", jsonString.substring(0, 200));
            return { nodes: [], edges: [] };
        } catch (e: any) {
            console.error("[API Flows] SafeParseJsonElements: Erro ao parsear string JSON de 'elements':", e.message, jsonString.substring(0,200));
            return { nodes: [], edges: [] };
        }
    }
    console.warn("[API Flows] SafeParseJsonElements: Tipo inesperado para 'elements':", typeof jsonString);
    return { nodes: [], edges: [] };
}

function validateFlowElements(elements: any): elements is FlowElementData {
    if (!elements || typeof elements !== 'object') return false;
    if (!Array.isArray(elements.nodes) || !Array.isArray(elements.edges)) return false;
    return true;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    // Garante a inicialização do DB uma vez por instância da API (ou use a flag global em db-mysql.ts)
    // A flag 'tablesInitialized' dentro de initializeAllTables já previne execuções repetidas das queries de schema.
    if (!serverDbInitialized || process.env.NODE_ENV === 'development') { // Em dev, pode ser útil re-verificar mais vezes
        try {
            console.log(`[API Flows ${req.method}] Verificando/Inicializando tabelas do banco de dados (serverDbInitialized: ${serverDbInitialized})...`);
            await initializeAllTables(); 
            serverDbInitialized = true; 
            console.log(`[API Flows ${req.method}] Verificação/Inicialização de tabelas concluída.`);
        } catch (initError: any) {
            console.error(`[API Flows ${req.method}] FALHA CRÍTICA NA INICIALIZAÇÃO DO BANCO DE DADOS:`, initError);
            return res.status(503).json({ message: "Serviço de banco de dados não inicializado corretamente.", error: "DB_INIT_FAILURE", details: initError.message });
        }
    }

    let dbConnection: mysql.PoolConnection | null = null;
    try {
        const dbPool = getDbPool();
        if (!dbPool) {
            // Este erro já seria lançado por getDbPool se as envs estivessem faltando
            console.error("[API Flows] Falha crítica: Pool de conexão MySQL não disponível após inicialização.");
            return res.status(503).json({ message: "Serviço de banco de dados indisponível.", error: "DB_POOL_UNAVAILABLE" });
        }

        dbConnection = await dbPool.getConnection();
        console.debug(`[API Flows ${req.method}] Conexão com DB obtida do pool.`);

        if (req.method === 'GET') {
            const { id, campaignId } = req.query;

            if (id) {
                const flowId = Array.isArray(id) ? id[0] : id;
                const flowIdNum = parseInt(flowId, 10);
                if (isNaN(flowIdNum) || flowIdNum <= 0) {
                    return res.status(400).json({ message: "ID do fluxo inválido.", error: "INVALID_FLOW_ID" });
                }
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(
                    'SELECT * FROM flows WHERE id = ?',
                    [flowIdNum]
                );
                if (rows.length > 0) {
                    const flowFromDb = rows[0];
                    const flowData: FlowData = {
                        id: flowFromDb.id,
                        name: flowFromDb.name,
                        status: flowFromDb.status,
                        campaign_id: flowFromDb.campaign_id,
                        elements: safeParseJsonElements(flowFromDb.elements),
                        created_at: flowFromDb.created_at ? new Date(flowFromDb.created_at).toISOString() : undefined,
                        updated_at: flowFromDb.updated_at ? new Date(flowFromDb.updated_at).toISOString() : undefined,
                    };
                    res.status(200).json(flowData);
                } else {
                    res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado`, error: "FLOW_NOT_FOUND" });
                }
            } else {
                const campIdValue = Array.isArray(campaignId) ? campaignId[0] : campaignId;
                let query = 'SELECT id, name, status, campaign_id, updated_at FROM flows';
                const params: (string | number | null)[] = [];
                if (campIdValue === 'none' || campIdValue === 'null') {
                    query += ' WHERE campaign_id IS NULL';
                } else if (campIdValue && campIdValue !== 'all') {
                    query += ' WHERE campaign_id = ?';
                    params.push(campIdValue);
                }
                query += ' ORDER BY updated_at DESC, name ASC';
                const [rows] = await dbConnection.query<mysql.RowDataPacket[]>(query, params);
                const flowListItems: FlowListItem[] = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    campaign_id: row.campaign_id,
                    updated_at: new Date(row.updated_at).toISOString(),
                }));
                res.status(200).json(flowListItems);
            }
        }
        else if (req.method === 'POST') {
            await dbConnection.beginTransaction();
            console.debug("[API Flows POST] Transação iniciada.");
            const { name, campaign_id, elements: initialElements, status: initialStatus, user_id } = req.body; // Adicionado user_id

            if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 150) {
                await dbConnection.rollback();
                return res.status(400).json({ message: "Nome do fluxo é obrigatório e deve ter entre 1 e 150 caracteres.", error: "INVALID_FLOW_NAME" });
            }

            const campaignIdToSave = (campaign_id === 'none' || campaign_id === '' || campaign_id === undefined) ? null : campaign_id;
            const flowStatus = (initialStatus && ['active', 'inactive', 'draft'].includes(initialStatus)) ? initialStatus : 'draft';
            const userIdToSave = user_id ? parseInt(user_id, 10) : null;
             if (user_id && isNaN(userIdToSave as number)) {
                await dbConnection.rollback();
                return res.status(400).json({ message: "user_id inválido.", error: "INVALID_USER_ID" });
            }


            let elementsToSave = initialElements;
            if (initialElements && !validateFlowElements(initialElements)) {
                await dbConnection.rollback();
                return res.status(400).json({ message: "Estrutura de 'elements' (nodes/edges) inválida.", error: "INVALID_ELEMENTS_STRUCTURE" });
            }
            if (!elementsToSave) {
                elementsToSave = { nodes: [], edges: [] };
            }
            const elementsJson = JSON.stringify(elementsToSave);

            if (flowStatus === 'active') {
                console.log(`[API Flows POST] Novo fluxo será ativo. Desativando outros fluxos ativos...`);
                await dbConnection.query("UPDATE flows SET status = 'inactive' WHERE status = 'active'");
            }

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(
                'INSERT INTO flows (name, user_id, campaign_id, elements, status) VALUES (?, ?, ?, ?, ?)', // Adicionado user_id
                [name.trim(), userIdToSave, campaignIdToSave, elementsJson, flowStatus]
            );
            const newFlowId = result.insertId;
            if (!newFlowId) {
                await dbConnection.rollback();
                throw new Error("Falha ao obter ID do fluxo recém-criado da inserção.");
            }

            const [newFlowRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT * FROM flows WHERE id = ?', [newFlowId]);
            if (newFlowRows.length === 0) {
                 await dbConnection.rollback();
                 throw new Error("Falha ao buscar fluxo recém-criado, apesar da inserção parecer bem-sucedida.");
            }
            
            await dbConnection.commit();
            console.debug("[API Flows POST] Transação commitada.");

            const newFlowFromDb = newFlowRows[0];
            const newFlowData: FlowData = {
                id: newFlowFromDb.id,
                name: newFlowFromDb.name,
                status: newFlowFromDb.status,
                user_id: newFlowFromDb.user_id, // Adicionado
                campaign_id: newFlowFromDb.campaign_id,
                elements: safeParseJsonElements(newFlowFromDb.elements),
                created_at: new Date(newFlowFromDb.created_at).toISOString(),
                updated_at: new Date(newFlowFromDb.updated_at).toISOString(),
            };
            res.status(201).json(newFlowData);
        }
        else if (req.method === 'PUT') {
            await dbConnection.beginTransaction();
            console.debug("[API Flows PUT] Transação iniciada.");
            const { id } = req.query;
            const { name, campaign_id, elements, status, user_id } = req.body; // Adicionado user_id

            if (!id) { await dbConnection.rollback(); return res.status(400).json({ message: "ID do fluxo é obrigatório para atualização.", error: "MISSING_FLOW_ID" }); }
            const flowId = Array.isArray(id) ? id[0] : id;
            const flowIdNum = parseInt(flowId, 10);
            if (isNaN(flowIdNum) || flowIdNum <= 0) {
                await dbConnection.rollback();
                return res.status(400).json({ message: "ID do fluxo inválido.", error: "INVALID_FLOW_ID" });
            }

            const [existingFlowRows] = await dbConnection.query<mysql.RowDataPacket[]>('SELECT status FROM flows WHERE id = ? FOR UPDATE', [flowIdNum]);
            if (existingFlowRows.length === 0) {
                await dbConnection.rollback();
                return res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado para atualização.`, error: "FLOW_NOT_FOUND" });
            }
            const currentFlowStatusInDb = existingFlowRows[0].status;

            const updateFields: { [key: string]: any } = {};
            if (name !== undefined) {
                if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 150) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Nome do fluxo deve ter entre 1 e 150 caracteres.", error: "INVALID_FLOW_NAME" });
                }
                updateFields.name = name.trim();
            }
            if (campaign_id !== undefined) {
                updateFields.campaign_id = (campaign_id === 'none' || campaign_id === '') ? null : campaign_id;
            }
            if (user_id !== undefined) { // Adicionado user_id
                const userIdToSave = user_id ? parseInt(user_id, 10) : null;
                if (user_id && isNaN(userIdToSave as number)) {
                     await dbConnection.rollback();
                    return res.status(400).json({ message: "user_id inválido para PUT.", error: "INVALID_USER_ID_PUT" });
                }
                updateFields.user_id = userIdToSave;
            }
            if (elements !== undefined) {
                if (elements === null || validateFlowElements(elements)) {
                    updateFields.elements = elements === null ? null : JSON.stringify(elements);
                } else {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: "Estrutura de 'elements' (nodes/edges) inválida.", error: "INVALID_ELEMENTS_STRUCTURE" });
                }
            }
            if (status !== undefined) {
                if (!['active', 'inactive', 'draft'].includes(status)) {
                    await dbConnection.rollback();
                    return res.status(400).json({ message: `Status inválido: ${status}. Use 'active', 'inactive' ou 'draft'.`, error: "INVALID_STATUS" });
                }
                updateFields.status = status;
            }

            if (Object.keys(updateFields).length === 0) {
                await dbConnection.commit();
                return res.status(200).json({ message: `Nenhuma alteração fornecida para o fluxo ${flowIdNum}.`, id: flowIdNum, changes: 0 });
            }
            
            const setClauses = Object.keys(updateFields).map(key => `${dbConnection.escapeId(key)} = ?`).join(', ');
            const paramsForUpdate = [...Object.values(updateFields), flowIdNum];

            console.log(`[API Flows PUT /id=${flowIdNum}] Atualizando com campos: ${Object.keys(updateFields).join(', ')}`);

            if (updateFields.status === 'active' && currentFlowStatusInDb !== 'active') {
                 console.log(`[API Flows PUT] Ativando fluxo ${flowIdNum}. Desativando outros fluxos ativos...`);
                 await dbConnection.query("UPDATE flows SET status = 'inactive' WHERE status = 'active' AND id != ?", [flowIdNum]);
            }

            const [result] = await dbConnection.query<mysql.ResultSetHeader>(
                 `UPDATE flows SET ${setClauses} WHERE id = ?`,
                 paramsForUpdate
            );
            
            await dbConnection.commit();
            console.debug("[API Flows PUT] Transação commitada.");

            const [finalFlowRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM flows WHERE id = ?', [flowIdNum]);
            if (finalFlowRows.length > 0) {
                const finalFlowFromDb = finalFlowRows[0];
                const finalFlowData: FlowData = {
                    id: finalFlowFromDb.id,
                    name: finalFlowFromDb.name,
                    status: finalFlowFromDb.status,
                    user_id: finalFlowFromDb.user_id, // Adicionado
                    campaign_id: finalFlowFromDb.campaign_id,
                    elements: safeParseJsonElements(finalFlowFromDb.elements),
                    created_at: new Date(finalFlowFromDb.created_at).toISOString(),
                    updated_at: new Date(finalFlowFromDb.updated_at).toISOString(),
                };
                res.status(200).json(finalFlowData);
            } else {
                 console.error(`[API Flows PUT /id=${flowIdNum}] Fluxo atualizado, mas não encontrado para retorno.`);
                 res.status(404).json({ message: `Fluxo com ID ${flowIdNum} atualizado, mas não encontrado para retorno.`, error: "POST_UPDATE_NOT_FOUND" });
            }
        }
         else if (req.method === 'DELETE') {
            await dbConnection.beginTransaction();
            console.debug("[API Flows DELETE] Transação iniciada.");
            const { id } = req.query;
            if (!id) { await dbConnection.rollback(); return res.status(400).json({ message: "ID do fluxo é obrigatório para deletar.", error: "MISSING_FLOW_ID" }); }
            const flowId = Array.isArray(id) ? id[0] : id;
            const flowIdNum = parseInt(flowId, 10);
            if (isNaN(flowIdNum) || flowIdNum <= 0) {
                await dbConnection.rollback();
                return res.status(400).json({ message: "ID do fluxo inválido.", error: "INVALID_FLOW_ID" });
            }

            console.log(`[API Flows DELETE /id=${flowIdNum}] Deletando fluxo.`);
            const [result] = await dbConnection.query<mysql.ResultSetHeader>(
                'DELETE FROM flows WHERE id = ?',
                [flowIdNum]
            );

            if (result.affectedRows === 0) {
                await dbConnection.rollback();
                return res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado para deletar.`, error: "FLOW_NOT_FOUND" });
            }
            await dbConnection.commit();
            console.debug("[API Flows DELETE] Transação commitada.");
            console.log(`[API Flows DELETE /id=${flowIdNum}] Fluxo deletado com sucesso.`);
            res.status(200).json({ message: `Fluxo ${flowIdNum} deletado com sucesso.`, id: flowIdNum, changes: result.affectedRows });
        }
        else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ message: `Método ${req.method} não permitido para /api/flows`, error: "METHOD_NOT_ALLOWED" });
        }

    } catch (error: any) {
        if (dbConnection) {
            try {
                await dbConnection.rollback();
                console.debug(`[API Flows ${req?.method}] Transação rollbackada devido a erro.`);
            } catch (rollbackError: any) {
                console.error(`[API Flows ${req?.method}] Erro durante rollback da transação:`, rollbackError);
            }
        }
        console.error(`[API Flows ${req?.method || 'UNKNOWN_METHOD'}] Erro geral: ${error.message}`, { code: error.code, sqlMessage: error.sqlMessage, stack: error.stack?.substring(0, 500) });
        const userMessage = (process.env.NODE_ENV === 'development' && error.sqlMessage) ? error.sqlMessage : 'Erro interno no servidor ao processar solicitação de fluxos.';
        res.status(500).json({
            message: userMessage,
            error: error.code || 'INTERNAL_SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (dbConnection) {
            dbConnection.release();
            console.debug(`[API Flows ${req?.method}] Conexão com DB liberada.`);
        }
    }
}
