import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// Define the expected types for chat messages, matching the context and likely the agent backend
interface Message {
    id: string; // Unique ID for the message (e.g., UUID)
    role: 'user' | 'assistant' | 'tool' | 'function';
    content: string | null;
    tool_call_id?: string | null;
    name?: string | null;
    // Add any other properties relevant to the message structure
}

// Type for a saved conversation, now including history
interface SavedConversation {
    id: number;
    user_id: number;
    session_id: string; // The session ID this conversation was saved from
    name: string;
    history: Message[]; // History will be an array of Message objects
    created_at: string; // Or Date
}

// Type for the list view (metadata without history)
interface SavedConversationMetadata {
    id: number;
    user_id: number;
    session_id: string;
    name: string;
    created_at: string;
}


// Authentication middleware to get user_id from JWT
const authenticate = (req: NextApiRequest): number | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number; [key: string]: any };
        return decoded.userId;
    } catch (error) {
        console.error("Erro ao verificar JWT:", error);
        return null;
    }
};


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SavedConversationMetadata[] | SavedConversation | { success: boolean; message?: string } | { error: string }>
) {
    // Ensure all tables are initialized before any DB operation
    try {
        await initializeAllTables();
    } catch (dbInitError) {
        console.error("[API McpSavedConversations] Critical error during DB initialization:", dbInitError);
        return res.status(500).json({ error: 'Internal server error: Database initialization failed.' });
    }

    const userId = authenticate(req);

    if (userId === null) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const dbPool = getDbPool();
    if (!dbPool) {
        console.error("[API McpSavedConversations] DB pool not available after initialization.");
        return res.status(500).json({ error: 'Internal server error (DB Pool) after initialization.' });
    }

    try {
        if (req.method === 'GET') {
            // Handle GET requests for listing or getting a specific conversation
            const savedConversationId = req.query.id as string;

            if (savedConversationId) {
                 // Fetch a specific saved conversation by ID (and ensure it belongs to the user)
                 console.log(`[API McpSavedConversations] Fetching saved conversation by ID: ${savedConversationId} for User ID: ${userId}`);
                 const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                     `SELECT id, user_id, session_id, name, history, created_at FROM mcp_saved_conversations WHERE id = ? AND user_id = ?`,
                     [savedConversationId, userId]
                 );

                 if (rows.length === 0) {
                     console.log(`[API McpSavedConversations] Saved conversation ID ${savedConversationId} not found or does not belong to user ${userId}.`);
                     return res.status(404).json({ error: 'Saved conversation not found or access denied.' });
                 }

                 const savedConversation = rows[0];
                 try {
                     // Parse the history JSON string back into an array of messages
                     const history = JSON.parse(savedConversation.history);
                     res.status(200).json({
                         id: savedConversation.id,
                         user_id: savedConversation.user_id,
                         session_id: savedConversation.session_id,
                         name: savedConversation.name,
                         created_at: savedConversation.created_at,
                         history: history as Message[] // Ensure the type is correct
                     } as SavedConversation);

                 } catch (jsonError) {
                     console.error(`[API McpSavedConversations] Error parsing history JSON for ID ${savedConversationId}:`, jsonError);
                     return res.status(500).json({ error: 'Internal server error: Failed to parse conversation history.' });
                 }

            } else {
                // List all saved conversations for the user (metadata only)
                console.log(`[API McpSavedConversations] Fetching all saved conversations for User ID: ${userId}`);
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                    // Select only metadata fields, history is not needed for the list
                    `SELECT id, user_id, session_id, name, created_at FROM mcp_saved_conversations WHERE user_id = ? ORDER BY created_at DESC`,
                    [userId]
                );
                res.status(200).json(rows as SavedConversationMetadata[]);
            }

        } else if (req.method === 'POST') {
            // Save the current conversation history
            const { sessionId, name, history } = req.body; // Expecting history as Message[]
            console.log(`[API McpSavedConversations] Received POST for User ID: ${userId}, Session ID: ${sessionId}, Name: "${name}"`);

            if (!sessionId || !name || !history) {
                return res.status(400).json({ error: 'Session ID, name, and history are required.' });
            }

            if (!Array.isArray(history)) {
                 return res.status(400).json({ error: 'History must be an array.' });
            }

            try {
                 // Stringify the history array for storage
                const historyJson = JSON.stringify(history);

                // Insert the new saved conversation record
                const [result] = await dbPool.query<mysql.OkPacket>(
                    `INSERT INTO mcp_saved_conversations (user_id, session_id, name, history) VALUES (?, ?, ?, ?)`,
                    [userId, sessionId, name, historyJson] // Include historyJson in the insert
                );
                console.log(`[API McpSavedConversations] Conversation saved (ID: ${result.insertId}).`);

                // Fetch and return the complete saved item, including history
                // Although the list only needs metadata, returning the full object confirms the save
                const [newRows] = await dbPool.query<mysql.RowDataPacket[]>(
                     `SELECT id, user_id, session_id, name, history, created_at FROM mcp_saved_conversations WHERE id = ?`,
                     [result.insertId]
                );

                if (newRows.length === 0) {
                     // Should not happen if insert was successful
                     return res.status(500).json({ error: 'Failed to retrieve saved conversation after insert.' });
                }

                const savedConversation = newRows[0];
                 try {
                     const historyParsed = JSON.parse(savedConversation.history);
                      res.status(201).json({
                         id: savedConversation.id,
                         user_id: savedConversation.user_id,
                         session_id: savedConversation.session_id,
                         name: savedConversation.name,
                         created_at: savedConversation.created_at,
                         history: historyParsed as Message[]
                     } as SavedConversation);

                 } catch (jsonError) {
                      console.error(`[API McpSavedConversations] Error parsing history JSON after saving (ID ${result.insertId}):`, jsonError);
                     return res.status(500).json({ error: 'Internal server error: Failed to parse conversation history after saving.' });
                 }


            } catch (error: any) {
                console.error("[API McpSavedConversations] Error saving conversation:", error);
                // Check for specific duplicate entry errors based on unique constraints
                if (error.code === 'ER_DUP_ENTRY') {
                    // Assuming unique index 'unique_user_name' on (user_id, name)
                    if (error.sqlMessage && error.sqlMessage.includes('unique_user_name')) {
                         return res.status(409).json({ success: false, message: `A conversation with the name "${name}" already exists for this user.` });
                    }
                     // Assuming unique index 'unique_user_session' on (user_id, session_id) - maybe not needed if user can save same session multiple times with diff names?
                     // If you want a user to only save a *given session* once, you'd need this constraint.
                     // If they can save the same session multiple times with different names, this constraint is wrong.
                     // Let's assume they can save the same session multiple times with different names, so no unique constraint on (user_id, session_id).
                }
                return res.status(500).json({ error: `Error saving conversation: ${error.message}` });
            }

        } else if (req.method === 'DELETE') {
            // Delete a specific saved conversation
            const { savedConversationId } = req.query; // Use query parameter for ID
            console.log(`[API McpSavedConversations] Received DELETE for Saved Conversation ID: ${savedConversationId}, User ID: ${userId}`);

            if (!savedConversationId) {
                return res.status(400).json({ error: 'Saved conversation ID is required.' });
            }

            const [result] = await dbPool.query<mysql.OkPacket>(
                `DELETE FROM mcp_saved_conversations WHERE id = ? AND user_id = ?`,
                [savedConversationId, userId]
            );

            if (result.affectedRows > 0) {
                console.log(`[API McpSavedConversations] Saved conversation (ID: ${savedConversationId}) deleted.`);
                res.status(200).json({ success: true, message: 'Conversation deleted successfully.' });
            } else {
                // Could be that the ID does not exist or does not belong to the user
                res.status(404).json({ success: false, message: 'Saved conversation not found or access denied.' });
            }

        } else {
            // Method not allowed
            res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        // Catch errors not handled in specific try/catch blocks
        console.error(`[API McpSavedConversations] Error in general handler:`, error);
        // Re-check for ER_NO_SUCH_TABLE in case initialization failed
        if (error.code === 'ER_NO_SUCH_TABLE') {
             console.warn(`[API McpSavedConversations] Table mcp_saved_conversations not found during operation. Initialization may have failed.`);
             return res.status(500).json({ error: 'Internal server error: Database table not found. Initialization may have failed.' });
        }
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
}
