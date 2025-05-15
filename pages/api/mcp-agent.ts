// pages/api/mcp-agent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    Part,
    Content,
    FunctionDeclaration,
    GenerateContentCandidate,
    SchemaType, // Usando SchemaType para versões recentes (> 0.9.0)
} from "@google/generative-ai";
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

interface AgentAction { type: 'navigate' | 'copy_suggestion' | string; payload?: any; }
interface AgentApiResponse { response: string; action?: AgentAction | null; }
interface RequestBody {
    message: string;
    context: {
        path: string;
        lang?: string;
        campaign_id?: string | number | null;
        form_data?: any;
    };
    lastActionContext?: AgentAction | null;
}
interface DbHistoryMessage {
    id: number;
    session_id: string;
    message_order: number;
    role: 'system' | 'user' | 'assistant' | 'tool' | 'function'; // DB roles
    content: string | null; // Pode ser texto ou JSON (para functionCall)
    tool_call_id?: string | null; // Usado em algumas versões antigas ou outros modelos
    name?: string | null; // Nome da função chamada/executada
}
interface CopyGenerationParams {
    copy_type: 'title' | 'body' | 'caption' | 'cta_variation';
    campaign_context: {
        name: string;
        target_audience?: string | null;
        objective?: string | null;
    };
    existing_cta?: string | null;
    tone?: 'formal' | 'informal' | 'persuasive' | 'urgent' | 'creative' | 'informative' | null;
    num_variations?: number | null;
    max_length?: number | null;
}

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const jwtSecret = process.env.JWT_SECRET || "DEFAULT_SECRET_CHANGE_ME";
if (!geminiApiKey) { console.warn("!!! ATENÇÃO: GEMINI_API_KEY não definida !!!"); }
if (!jwtSecret || jwtSecret === "DEFAULT_SECRET_CHANGE_ME") { console.warn("!!! ATENÇÃO: JWT_SECRET inválido ou não definido !!!"); }

const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModelName = "gemini-1.5-flash-latest";
const MAX_HISTORY_DB_MESSAGES = 10; // Aumentado para tentar capturar sequências user/model completas

const featureExplanations: { [key: string]: { [lang: string]: string } } = {
  '/': { 'pt-BR': 'O Dashboard Principal exibe um resumo dos seus KPIs de marketing, como total de cliques, impressões, conversões, custo e receita, além de métricas derivadas como CTR, CPC, CPA e ROI.', 'en-US': 'The Main Dashboard displays a summary of your marketing KPIs, such as total clicks, impressions, conversions, cost, and revenue, as well as derived metrics like CTR, CPC, CPA, and ROI.' },
  '/Metrics': { 'pt-BR': 'A página de Métricas permite uma análise detalhada do desempenho de suas campanhas ao longo do tempo, com gráficos de performance, custos e receita/ROI. Você também pode adicionar métricas diárias manualmente aqui.', 'en-US': 'The Metrics page allows for detailed performance analysis of your campaigns over time, with charts for performance, costs, and revenue/ROI. You can also manually add daily metrics here.' },
  '/campaigns': { 'pt-BR': 'Em Gerenciamento de Campanhas, você pode listar, visualizar detalhes, criar novas campanhas e modificar campanhas existentes.', 'en-US': 'In Campaign Management, you can list, view details, create new campaigns, and modify existing campaigns.' },
  '/Budget': { 'pt-BR': 'A Análise de Orçamento ajuda a comparar o orçamento planejado com os gastos e receitas reais, mostrando o uso do orçamento, saldo restante e distribuição de custos.', 'en-US': 'Budget Analysis helps compare your planned budget with actual spending and revenue, showing budget utilization, remaining balance, and cost distribution.' },
  '/Funnel': { 'pt-BR': 'O Simulador de Funil permite projetar resultados de campanhas com base em métricas de entrada (investimento, CPC, taxas de conversão) e também calcular o LTV (Lifetime Value) do cliente.', 'en-US': 'The Funnel Simulator allows you to project campaign outcomes based on input metrics (investment, CPC, conversion rates) and also calculate customer LTV (Lifetime Value).' },
  '/creatives': { 'pt-BR': 'A página de Criativos é destinada ao gerenciamento dos seus anúncios e materiais visuais de campanha. (Funcionalidade em desenvolvimento)', 'en-US': 'The Creatives page is for managing your ads and visual campaign materials. (Functionality in development)' },
  '/alerts': { 'pt-BR': 'Em Alertas, você receberá notificações importantes sobre suas campanhas ou sobre a plataforma. (Funcionalidade em desenvolvimento)', 'en-US': 'In Alerts, you will receive important notifications about your campaigns or the platform.' },
  '/zap': { 'pt-BR': 'A seção Zap refere-se à integração com o WhatsApp, ideal para automação de comunicação e notificações.', 'en-US': 'The Zap section refers to WhatsApp integration, ideal for communication automation and notifications.' },
  '/ltv': { 'pt-BR': 'A página LTV é focada na análise detalhada do Valor do Tempo de Vida do Cliente, um KPI crucial para a sustentabilidade do negócio.', 'en-US': 'The LTV page focuses on detailed analysis of Customer Lifetime Value, a crucial KPI for business sustainability.' },
  '/export': { 'pt-BR': 'A funcionalidade Exportar permite que você baixe relatórios de desempenho de campanhas ou resumos de orçamento nos formatos PDF ou CSV.', 'en-US': 'The Export functionality allows you to download campaign performance reports or budget summaries in PDF or CSV formats.' },
  '/webpage': { 'pt-BR': 'O Construtor de Webpages (Builder Studio) é uma ferramenta para criar páginas de destino ou outras páginas web simples visualmente.', 'en-US': 'The Webpage Builder (Builder Studio) is a tool for visually creating landing pages ou other simple web pages.' },
  '/Chat': { 'pt-BR': 'A página Chat IA é um espaço para conversa direta com o assistente Ubie, sem o contexto de uma página específica da aplicação.', 'en-US': 'The Chat AI page is a space for direct conversation with the Ubie assistant, without the context of a specific application page.' },
  '/CopyPage': { 'pt-BR': 'A página de Planejamento de Copy é onde você pode gerenciar os textos (cópias) para suas campanhas e usar o Ubie Copywriter para gerar sugestões.', 'en-US': 'The Copy Planning page is where you can manage texts (copy) for your campaigns and use the Ubie Copywriter to generate suggestions.' },
   '/Dates': { 'pt-BR': 'A página de Datas lida com o agendamento e a visualização de eventos relacionados a campanhas. (Funcionalidade em desenvolvimento)', 'en-US': 'The Dates page deals with scheduling and viewing campaign-related events.'}, // Adicionado '/Dates' conforme implícito nos logs
  'default': { 'pt-BR': 'Explicação indisponível.', 'en-US': "Explanation unavailable." }
};

const UBIE_SYSTEM_INSTRUCTION_TEXT = (currentPath: string, userLang: string) => `
Você é Ubie, um assistente IA avançado para o aplicativo de marketing digital USBMKT V50MCP.
Seu objetivo principal é ajudar o usuário a navegar na aplicação, gerenciar campanhas, gerar textos de marketing (copy), entender funcionalidades e executar tarefas relacionadas ao USBMKT V50MCP.
Responda no MESMO IDIOMA da pergunta do usuário. Contexto atual: Página ${currentPath}, Idioma ${userLang}.

**Comportamento e Prioridades:**
1.  **Ações Diretas da Aplicação:** Se o usuário solicitar uma ação que corresponde DIRETAMENTE a uma das Funções Disponíveis (definidas como "tools"), use SEMPRE essas funções.
2.  **Perguntas sobre Marketing/Resultados/Estratégia:** Se a pergunta for sobre marketing, clientes, performance, ou estratégia (ex: "Qual campanha teve melhor ROI?", "Sugira uma estratégia"), VERIFIQUE se uma Ferramenta pode ajudar. Se não, responda textualmente explicando limitações e oferecendo insights gerais de marketing.
3.  **Conversa Geral:** Se a pergunta for CLARAMENTE de conhecimento geral e não tiver relação com marketing ou aplicação, responda conversacionalmente, mas breve, e retorne o foco à aplicação.
4.  **Informações Insuficientes / Limitações:** Peça mais detalhes se necessário ou informe limitações.
Não inclua o nome da função chamada na sua resposta textual ao usuário após a execução da ferramenta, a menos que seja relevante para a explicação. Apenas forneça o resultado ou uma confirmação.
Evite usar markdown para formatar suas respostas de texto simples, a menos que seja para listas ou links explicitamente.
As páginas conhecidas são: ${Object.keys(featureExplanations).filter(k => k !== 'default').join(', ')}.
`;

const getToolDeclarations = (): FunctionDeclaration[] => ([
    {
        name: "navigate",
        description: "Navega para uma página da aplicação.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                path: { type: SchemaType.STRING, description: "O caminho da página (ex: '/campaigns', '/Metrics')" }
            },
            required: ["path"]
        }
    },
    {
        name: "list_campaigns",
        description: "Lista as campanhas existentes.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
        name: "get_campaign_details",
        description: "Obtém detalhes de uma campanha específica.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                campaign_name: { type: SchemaType.STRING, description: "Nome da campanha a ser detalhada." }
            },
            required: ["campaign_name"]
        }
    },
    {
        name: "create_campaign",
        description: "Cria uma nova campanha. Após a criação bem-sucedida, o sistema automaticamente navega para '/campaigns'.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                name: { type: SchemaType.STRING, description: "Nome da nova campanha." },
                budget: { type: SchemaType.NUMBER, description: "Orçamento diário da nova campanha." }
            },
            required: ["name", "budget"]
        }
    },
    {
        name: "modify_campaign",
        description: "Modifica uma campanha existente.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                identifier: {
                    type: SchemaType.OBJECT,
                    properties: { name: { type: SchemaType.STRING, description: "Nome atual da campanha a ser modificada." } },
                    required: ["name"]
                },
                // Para SchemaType.OBJECT, 'properties' é obrigatório em versões recentes.
                fields_to_update: {
                    type: SchemaType.OBJECT,
                    description: "Objeto com campos e novos valores (ex: {\"name\": \"Novo Nome\", \"daily_budget\": 150})",
                    properties: {} // Adicionado para satisfazer o tipo OBJECT
                }
            },
            required: ["identifier", "fields_to_update"]
        }
    },
    {
        name: "list_available_pages",
        description: "Lista as páginas e funcionalidades disponíveis na aplicação.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
        name: "explain_feature",
        description: "Explica uma funcionalidade ou página da aplicação.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                page_path: { type: SchemaType.STRING, description: "Caminho da página a explicar (ex: '/Metrics'). Se omitido, usa a página atual." },
                element_name: { type: SchemaType.STRING, description: "(Opcional) Nome de um elemento específico na página." }
            },
            required: []
        }
    },
    {
        name: "export_report",
        description: "Prepara um link para download de um relatório.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                report_type: { type: SchemaType.STRING, description: "Tipo de relatório (ex: 'campaign_performance', 'budget_summary')." },
                // Para STRING com enum, é necessário adicionar format: "enum"
                format: { type: SchemaType.STRING, enum: ['pdf', 'csv'], description: "Formato do relatório ('pdf' ou 'csv'). Padrão 'pdf'.", format: "enum" },
                campaign_id: { type: SchemaType.STRING, description: "(Opcional) ID da campanha para o relatório." },
                campaign_name: { type: SchemaType.STRING, description: "(Opcional) Nome da campanha, se ID não fornecido." },
                start_date: { type: SchemaType.STRING, description: "(Opcional) Data de início (YYYY-MM-DD)." },
                end_date: { type: SchemaType.STRING, description: "(Opcional) Data de fim (YYYY-MM-DD)." }
            },
            required: ["report_type"]
        }
    },
    {
        name: "generate_copy_suggestion",
        description: "Gera sugestões de texto (copy) para marketing.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                // Para STRING com enum, é necessário adicionar format: "enum"
                copy_type: { type: SchemaType.STRING, enum: ["title", "body", "caption", "cta_variation"], description: "Tipo de texto a gerar.", format: "enum" },
                campaign_context: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING, description: "Nome da campanha." },
                        target_audience: { type: SchemaType.STRING, description: "(Opcional) Descrição do público-alvo." },
                        objective: { type: SchemaType.STRING, description: "(Opcional) Objetivo da campanha." }
                    },
                    required: ["name"]
                },
                existing_cta: { type: SchemaType.STRING, description: "(Opcional) CTA existente para gerar variações." },
                // Para STRING com enum, é necessário adicionar format: "enum"
                tone: { type: SchemaType.STRING, enum: ["formal", "informal", "persuasive", "urgent", "creative", "informative"], description: "(Opcional) Tom de voz desejado.", format: "enum" },
                num_variations: { type: SchemaType.NUMBER, description: "(Opcional) Número de sugestões a gerar (padrão 1)." },
                max_length: { type: SchemaType.NUMBER, description: "(Opcional) Comprimento máx. aproximado em caracteres." }
            },
            required: ["copy_type", "campaign_context"]
        }
    }
]);

async function getHistoryFromDB(sessionId: string, limit: number): Promise<DbHistoryMessage[]> {
    const dbPool = getDbPool(); if (!dbPool) { console.error("[DB History] Pool não disponível."); return []; }
    try {
        // Fetch messages ordered by message_order ascending to get chronological history
        // Limiting might cut off the start of a conversation sequence. Fetch slightly more if needed.
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
            `SELECT id, session_id, message_order, role, content, tool_call_id, name
             FROM mcp_conversation_history
             WHERE session_id = ?
             ORDER BY message_order ASC
             LIMIT ?`, // Order ASC here is correct for chronological history
            [sessionId, limit]
        );
        // No need to sort in JS if ordering in SQL is correct
        return rows as DbHistoryMessage[];
    } catch (error) { console.error(`[DB History] Erro buscar histórico ${sessionId}:`, error); return []; }
}

async function getLastMessageOrder(sessionId: string): Promise<number> {
    const dbPool = getDbPool(); if (!dbPool) { console.error("[DB History] Pool não disponível."); return 0; }
    try {
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(`SELECT message_order FROM mcp_conversation_history WHERE session_id = ? ORDER BY message_order DESC LIMIT 1`, [sessionId]);
        return rows.length > 0 ? rows[0].message_order : 0;
    } catch (error) { console.error(`[DB History] Erro buscar última ordem ${sessionId}:`, error); return 0; }
}

async function saveMessageToDB(sessionId: string, message: Omit<DbHistoryMessage, 'id' | 'session_id' | 'message_order'>, order: number): Promise<void> {
    const dbPool = getDbPool(); if (!dbPool) { console.error("[DB History] Pool não disponível."); return; }
    try {
        const contentToSave = (typeof message.content === 'string' || message.content === null) ? message.content : JSON.stringify(message.content);
        await dbPool.query(`INSERT INTO mcp_conversation_history (session_id, message_order, role, content, tool_call_id, name) VALUES (?, ?, ?, ?, ?, ?)`, [sessionId, order, message.role, contentToSave, message.tool_call_id ?? null, message.name ?? null]);
    } catch (error) { console.error(`[DB History] Erro salvar mensagem ${sessionId} (ordem ${order}):`, error); }
}

const toolTranslations: { [key: string]: { [lang: string]: string } } = {
    campaignCreated: { 'pt-BR': "✅ Campanha \"{campaignName}\" (ID: {campaignId}) criada com sucesso com orçamento diário de {budget}.", 'en-US': "✅ Campaign \"{campaignName}\" (ID: {campaignId}) successfully created with a daily budget of {budget}." },
    campaignModifySuccess: { 'pt-BR': "✅ Campanha \"{campaignName}\" atualizada com sucesso! (Campos alterados: {updatedFields})", 'en-US': "✅ Campaign \"{campaignName}\" updated successfully! (Changed fields: {updatedFields})" },
};

function getToolMessage(key: string, lang: string = 'en-US', params: { [key: string]: string | number } = {}): string {
    const langToUse = toolTranslations[key]?.[lang] ? lang : (toolTranslations[key]?.['en-US'] ? 'en-US' : lang);
    let message = toolTranslations[key]?.[langToUse] || `Translation missing for tool message: ${key}`;
    for (const param in params) { message = message.replace(new RegExp(`{${param}}`, 'g'), String(params[param])); }
    return message;
}

const formatCurrency = (value?: number | null, lang: string = 'pt-BR'): string => {
    if (typeof value !== 'number' || isNaN(value)) return lang === 'pt-BR' ? 'N/D' : 'N/A';
    const locale = lang.startsWith('pt') ? 'pt-BR' : 'en-US'; const currency = lang.startsWith('pt') ? 'BRL' : 'USD';
    try { return value.toLocaleString(locale, { style: 'currency', currency: currency }); }
    catch (e) { return `${currency} ${value.toFixed(2)}`; }
};

// CORREÇÃO aprimorada para o erro "First content should be with role 'user'"
function mapDbMessagesToGeminiHistory(dbMessages: DbHistoryMessage[]): Content[] {
    const history: Content[] = [];

    // Ensure chronological order (should be handled by SQL query now)
    const chronologicalMessages = [...dbMessages].sort((a, b) => a.message_order - b.message_order);

    // Find the index of the first user message in the chronological history
    let firstUserMessageIndex = -1;
    for (let i = 0; i < chronologicalMessages.length; i++) {
        // Gemini requires history to start with a user role.
        // Note: Older models/APIs might have used 'tool' roles differently.
        // This logic assumes the DB roles 'user', 'assistant', 'tool', 'function' map cleanly.
        // 'system' roles from DB are ignored for chat history.
        if (chronologicalMessages[i].role === 'user') {
            firstUserMessageIndex = i;
            break;
        }
         // If we encounter a non-user, non-system message *before* the first user message,
         // it indicates a potentially broken history sequence from the DB's perspective for Gemini.
         // We could stop here and return empty/partial history, but let's keep looking for the first user.
         if (chronologicalMessages[i].role !== 'system') {
             console.warn(`[mapDbMessagesToGeminiHistory] Found non-user/non-system role (${chronologicalMessages[i].role}) before the first user message at order ${chronologicalMessages[i].message_order}.`);
         }
    }

    // If no user message is found in the fetched history window, cannot form a valid chat history for Gemini
    if (firstUserMessageIndex === -1) {
        // This might happen if the history window is too small or DB data is corrupted (e.g., only assistant/tool messages saved).
        console.warn("[mapDbMessagesToGeminiHistory] No user message found in fetched history window. Returning empty history.");
        return [];
    }

    // Slice the history to start from the first user message.
    // This is crucial because Gemini REQUIRES the history array to start with a 'user' role.
    const relevantHistory = chronologicalMessages.slice(firstUserMessageIndex);

    // Now map the relevant history, which is guaranteed (by the slice) to start with a user message (in DB terms)
    for (const dbMsg of relevantHistory) {
         if (dbMsg.role === 'system') continue; // System instructions are not part of chat history Content[]

        let parts: Part[] = [];

        if (dbMsg.role === 'user') {
            parts.push({ text: dbMsg.content || "" });
             // Only add if not empty after trimming
            if (parts[0].text.trim()) {
                history.push({ role: 'user', parts });
            } else {
                 console.warn(`[mapDbMessagesToGeminiHistory] Skipping empty user message (order ${dbMsg.message_order})`);
            }

        } else if (dbMsg.role === 'assistant') {
             // Map assistant messages (text or function calls)
            let isFunctionCall = false;
            if (dbMsg.content) {
                try {
                    const parsedContent = JSON.parse(dbMsg.content);
                     // Check for newer functionCall format (preferred)
                     if (parsedContent.name && typeof parsedContent.args === 'object') {
                         parts.push({ functionCall: { name: parsedContent.name, args: parsedContent.args } });
                         isFunctionCall = true;
                     } else if (parsedContent.tool_calls && Array.isArray(parsedContent.tool_calls) && parsedContent.tool_calls[0]) {
                         // Check for older tool_calls format (e.g., from Groq or older Gemini versions)
                        const oldTc = parsedContent.tool_calls[0];
                        if(oldTc.function && oldTc.function.name && typeof oldTc.function.arguments === 'string'){
                            try {
                                parts.push({ functionCall: { name: oldTc.function.name, args: JSON.parse(oldTc.function.arguments) }});
                                isFunctionCall = true;
                            } catch(e){ console.warn("Error parsing arguments from old tool_call format", e); }
                        } else if (oldTc.function && oldTc.function.name) {
                             // Handle case where arguments might be missing or null for older format
                             console.warn(`[mapDbMessagesToGeminiHistory] Old tool_calls format with missing/invalid arguments for function ${oldTc.function.name}`);
                              parts.push({ functionCall: { name: oldTc.function.name, args: {} } }); // Push with empty args as fallback? Or skip?
                              isFunctionCall = true; // Treat as function call attempt
                         }
                    } else {
                         // If content is JSON but not a recognized function call format
                          console.warn(`[mapDbMessagesToGeminiHistory] Assistant content is JSON but not function call format (order ${dbMsg.message_order}): ${dbMsg.content}`);
                          parts.push({ text: dbMsg.content }); // Treat as literal text
                     }
                } catch (e) {
                     // content is likely not JSON, treat as plain text
                      parts.push({ text: dbMsg.content || "" });
                 }
            } else {
                 // Content is null or empty string, treat as empty text
                  parts.push({ text: "" });
             }


             // Only add if we have non-empty parts (text should be non-empty after trim, functionCall is inherently non-empty)
            if (parts.length > 0 && (parts[0].text?.trim() || parts[0].functionCall)) { // Check trimmed text content
                 // Gemini role is 'model' for assistant text or function calls
                 history.push({ role: 'model', parts });
            } else {
                 console.warn(`[mapDbMessagesToGeminiHistory] Skipping empty or unparsable assistant message (order ${dbMsg.message_order}, raw content: ${dbMsg.content}).`);
            }


        } else if (dbMsg.role === 'tool' || dbMsg.role === 'function') {
             // Maps DB 'tool' or 'function' role to Gemini 'function' role
             // These are responses to function calls made by the model
            if (dbMsg.name && dbMsg.content !== null) { // Content can be an empty string for success Ack
                parts.push({
                    functionResponse: {
                        name: dbMsg.name,
                        response: { name: dbMsg.name, content: dbMsg.content }, // 'content' here is the tool's output (can be JSON string or text)
                    }
                });
                 // Only add if we have parts
                if (parts.length > 0) {
                     history.push({ role: 'function', parts });
                } else {
                     console.warn(`[mapDbMessagesToGeminiHistory] Skipping empty function response parts message (order ${dbMsg.message_order}, name ${dbMsg.name}).`);
                }
            } else {
                 console.warn(`[mapDbMessagesToGeminiHistory] Skipping function message with missing name or null content (order ${dbMsg.message_order}).`);
            }
        } else {
             console.warn(`[mapDbMessagesToGeminiHistory] Skipping message with unexpected role '${dbMsg.role}' (order ${dbMsg.message_order}).`);
        }
    }

    // Double-check that the first item is 'user' after mapping.
    if (history.length > 0 && history[0].role !== 'user') {
         console.error("[mapDbMessagesToGeminiHistory] FATAL LOGIC ERROR: Final history does not start with 'user' role after mapping! First role is:", history[0].role, history);
         // Return empty history as the safest way to prevent the API call from crashing.
         return [];
    }

    // Optional: Add validation for alternating roles if stricter history is required by the model version
    // For now, just log warnings if a common pattern is broken, but don't discard history
     // This section checks for expected sequence patterns (user -> model, model -> function, function -> model, model -> user)
     // It tolerates deviations but warns.
    for(let i = 0; i < history.length; i++){
        const current = history[i];
        const next = history[i+1];

        if (!next) continue; // End of history

        if (current.role === 'user') {
            if (next.role !== 'model') {
                 console.warn(`[mapDbMessagesToGeminiHistory] History Pattern Warning: user role not followed by model role at index ${i}. Next role: ${next.role}. History excerpt:`, history.slice(Math.max(0, i - 2), i + 3));
            }
        } else if (current.role === 'model') {
            const hasFunctionCall = current.parts.some(part => part.functionCall);
            if (hasFunctionCall) {
                 // Model with function call *should* be followed by a function response
                if (next.role !== 'function') {
                    console.warn(`[mapDbMessagesToGeminiHistory] History Pattern Warning: model (functionCall) not followed by function role at index ${i}. Next role: ${next.role}. History excerpt:`, history.slice(Math.max(0, i - 2), i + 3));
                }
            } else { // Model response is text
                 // Model with text should ideally be followed by a user message
                 if (next.role !== 'user') {
                     console.warn(`[mapDbMessagesToGeminiHistory] History Pattern Warning: model (text) not followed by user role at index ${i}. Next role: ${next.role}. History excerpt:`, history.slice(Math.max(0, i - 2), i + 3));
                 }
            }
        } else if (current.role === 'function') {
             // Function response should be followed by a model response (Gemini responding based on tool output)
             if (next.role !== 'model') {
                 console.warn(`[mapDbMessagesToGeminiHistory] History Pattern Warning: function role not followed by model role at index ${i}. Next role: ${next.role}. History excerpt:`, history.slice(Math.max(0, i - 2), i + 3));
            }
        }
    }

    return history;
}


async function findCampaignIdByName(name: string): Promise<string | null> {
    const dbPool = getDbPool(); if (!dbPool) return null;
    try { const [rows] = await dbPool.query<mysql.RowDataPacket[]>(`SELECT id FROM campaigns WHERE name = ? LIMIT 1`, [name]); return rows.length > 0 ? String(rows[0].id) : null; }
    catch (error) { console.error("[INTERNAL findCampaignIdByName] Erro buscar ID da campanha:", error); return null; }
}

async function internalCreateCampaign(args: { name?: string, budget?: number }, lang: string): Promise<{ result: string, navigateTo?: string }> {
    if (!args.name || typeof args.budget !== 'number' || args.budget < 0) return { result: lang === 'pt-BR' ? "❌ Nome da campanha e orçamento diário válido são obrigatórios." : "❌ Campaign name and a valid daily budget are required." };
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''; if (!baseUrl) return { result: lang === 'pt-BR' ? "❌ Falha na configuração interna do servidor (URL da API)." : "❌ Internal server configuration failure (API URL)." };
        const response = await axios.post(`${baseUrl}/api/campaigns`, { name: args.name, daily_budget: args.budget, status: 'draft' });
        if (response.data?.id) return { result: getToolMessage('campaignCreated', lang, { campaignName: args.name, campaignId: response.data.id, budget: formatCurrency(args.budget, lang) }), navigateTo: '/campaigns' };
        else return { result: `⚠️ Erro ao criar campanha (${response.status}): ${response.data?.message || (lang === 'pt-BR' ? 'Erro desconhecido da API.' : 'Unknown API error.')}` };
    } catch (error: any) { if (axios.isAxiosError(error)) return { result: `❌ Falha ao criar campanha: ${error.response?.data?.message || error.message}` }; return { result: lang === 'pt-BR' ? `❌ Falha crítica ao criar campanha.` : `❌ Critical failure creating campaign.` }; }
}

async function internalGetCampaignDetails(args: { campaign_name?: string }, lang: string): Promise<string> {
    if (!args.campaign_name) return lang === 'pt-BR' ? "❌ Por favor, especifique o nome da campanha." : "❌ Please specify the campaign name.";
    const dbPool = getDbPool(); if (!dbPool) return lang === 'pt-BR' ? "❌ Falha de conexão com o banco de dados." : "❌ Database connection failure.";
    try {
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(`SELECT id, name, status, budget, daily_budget, cost_traffic, cost_creative, cost_operational, start_date, end_date FROM campaigns WHERE name = ? LIMIT 1`, [args.campaign_name]);
        if (rows.length > 0) {
             const c = rows[0]; let totalCost = 0, totalRevenue = 0;
             try { const [mRows] = await dbPool.query<mysql.RowDataPacket[]>(`SELECT SUM(cost) as totalCost, SUM(revenue) as totalRevenue FROM daily_metrics WHERE campaign_id = ?`, [c.id]); totalCost = mRows[0]?.totalCost ?? 0; totalRevenue = mRows[0]?.totalRevenue ?? 0; } catch (mErr) { console.error(`[INTERNAL getCampaignDetails] Erro ao buscar métricas para campanha ${c.id}:`, mErr); }
             const detailsParts = [
                lang === 'pt-BR' ? `Detalhes da Campanha "${c.name}" (ID: ${c.id}):` : `Details for Campaign "${c.name}" (ID: ${c.id}):`,
                `- Status: ${c.status || (lang === 'pt-BR' ? 'Não definido' : 'Not set')}`,
                `- Orçamento Total Planejado: ${formatCurrency(c.budget, lang)}`,
                `- Orçamento Diário Planejado: ${formatCurrency(c.daily_budget, lang)}`,
                `- Custos Planejados: Tráfego ${formatCurrency(c.cost_traffic, lang)}, Criativo ${formatCurrency(c.cost_creative, lang)}, Operacional ${formatCurrency(c.cost_operational, lang)}`,
                `- Data de Início: ${c.start_date ? new Date(c.start_date).toLocaleDateString(lang.startsWith('pt') ? 'pt-BR' : 'en-CA') : (lang === 'pt-BR' ? 'Não definida' : 'Not set')}`,
                `- Data de Fim: ${c.end_date ? new Date(c.end_date).toLocaleDateString(lang.startsWith('pt') ? 'pt-BR' : 'en-CA') : (lang === 'pt-BR' ? 'Não definida' : 'Not set')}`,
                `- Custo Real Total (de daily_metrics): ${formatCurrency(totalCost, lang)}`,
                `- Receita Real Total (de daily_metrics): ${formatCurrency(totalRevenue, lang)}`,
             ];
             return detailsParts.join('\n');
        } else return lang === 'pt-BR' ? `ℹ️ Campanha "${args.campaign_name}" não encontrada.` : `ℹ️ Campaign "${args.campaign_name}" not found.`;
    } catch (error: any) { console.error(`[INTERNAL getCampaignDetails] Erro ao obter detalhes:`, error); return lang === 'pt-BR' ? `❌ Falha ao obter detalhes da campanha.` : `❌ Failed to retrieve campaign details.`; }
}

async function internalListCampaigns(args: {}, lang: string): Promise<string> {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''; if (!baseUrl) return lang === 'pt-BR' ? "❌ Falha na configuração interna do servidor." : "❌ Internal server configuration failure.";
        const response = await axios.get<{ id: string, name: string }[]>(`${baseUrl}/api/campaigns?fields=id,name&limit=50`); // Limit response size
        if (response.data.length === 0) return lang === 'pt-BR' ? "ℹ️ Nenhuma campanha encontrada." : "ℹ️ No campaigns found.";
        const list = response.data.map(c => `"${c.name}" (ID: ${c.id})`).join(', ');
        return lang === 'pt-BR' ? `📁 Campanhas encontradas (${response.data.length}): ${list}.` : `📁 Campaigns found (${response.data.length}): ${list}.`;
    } catch (error: any) { console.error(`[INTERNAL listCampaigns] Erro ao listar:`, error); return lang === 'pt-BR' ? `❌ Falha ao listar campanhas.` : `❌ Failed to list campaigns.`; }
}

async function internalModifyCampaign(args: { identifier?: { name?: string }, fields_to_update?: any }, lang: string): Promise<string> {
    if (!args.identifier?.name) return lang === 'pt-BR' ? "❌ Por favor, identifique a campanha pelo nome." : "❌ Please identify the campaign by name.";
    if (!args.fields_to_update || Object.keys(args.fields_to_update).length === 0) return lang === 'pt-BR' ? "❌ Por favor, especifique os campos a serem atualizados." : "❌ Please specify the fields to update.";
    let campaignId = await findCampaignIdByName(args.identifier.name); if (!campaignId) return lang === 'pt-BR' ? `❌ Campanha "${args.identifier.name}" não encontrada para modificação.` : `❌ Campaign "${args.identifier.name}" not found for modification.`;
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''; if (!baseUrl) return lang === 'pt-BR' ? "❌ Falha na configuração interna do servidor." : "❌ Internal server configuration failure.";
        const response = await axios.put(`${baseUrl}/api/campaigns?id=${campaignId}`, args.fields_to_update);
        if (response.status < 300) { // Check for success status codes (2xx)
             // Use updated name if provided, otherwise use the name from identifier
            const updatedName = args.fields_to_update.name || args.identifier.name;
            const updatedFieldsList = Object.keys(args.fields_to_update).join(', ');
            return getToolMessage('campaignModifySuccess', lang, { campaignName: updatedName, updatedFields: updatedFieldsList });
        }
        else return `⚠️ Erro ao modificar campanha (${response.status}): ${response.data?.message || (lang === 'pt-BR' ? 'Erro desconhecido da API.' : 'Unknown API error.')}`;
    } catch (error: any) { console.error(`[INTERNAL modifyCampaign] Erro ao modificar:`, error); if (axios.isAxiosError(error)) return `❌ Falha ao modificar campanha: ${error.response?.data?.message || error.message}`; return lang === 'pt-BR' ? `❌ Falha crítica ao modificar campanha.` : `❌ Critical failure modifying campaign.` ;}
}

async function internalListAvailablePages(args: {}, lang: string): Promise<string> {
     const pages = Object.keys(featureExplanations).filter(path => path !== 'default').map(path => ({ path, desc: featureExplanations[path]?.[lang as 'pt-BR'|'en-US']?.split('.')[0] || featureExplanations[path]?.['en-US']?.split('.')[0] || path }));
    const header = lang === 'pt-BR' ? "As seguintes seções e funcionalidades estão disponíveis na aplicação:\n" : "The following sections and features are available in the application:\n";
    return header + pages.map(p => `- **${p.path}**: ${p.desc}`).join('\n');
}

async function internalExplainFeature(args: { page_path?: string, element_name?: string }, lang: string, currentPath: string): Promise<string> {
    const targetPath = args.page_path || currentPath;
    const normalizedLang = lang.startsWith('pt') ? 'pt-BR' : 'en-US';
    let explanation = featureExplanations[targetPath]?.[normalizedLang] || featureExplanations['default'][normalizedLang];
    if (args.element_name && explanation !== featureExplanations['default'][normalizedLang]) {
        // If an element name is specified but we only have a page-level explanation
        explanation += (lang === 'pt-BR' ? `\n(No momento, não posso fornecer detalhes sobre o elemento específico '${args.element_name}' dentro desta página.)` : `\n(Currently, I cannot provide details about the specific element '${args.element_name}' within this page.)`);
    }
    return explanation;
}

async function internalExportReport(args: { report_type?: string, format?: string, campaign_id?: string, campaign_name?: string, start_date?: string, end_date?: string }, lang: string): Promise<string> {
    const { report_type, format = 'pdf', campaign_id, campaign_name, ...otherParams } = args;
    const validFormat = ['pdf', 'csv'].includes(format.toLowerCase()) ? format.toLowerCase() : 'pdf';
    if (!report_type) return lang === 'pt-BR' ? "❌ Por favor, especifique o tipo de relatório (ex: 'campaign_performance', 'budget_summary')." : "❌ Please specify the report type (e.g., 'campaign_performance', 'budget_summary').";

    let finalCampaignId = campaign_id;
    if (!finalCampaignId && campaign_name) {
        // If campaign_id is not provided, try to find it by name
        finalCampaignId = await findCampaignIdByName(campaign_name);
        if (!finalCampaignId) {
            return lang === 'pt-BR' ? `❌ Campanha "${campaign_name}" não encontrada para gerar o relatório.` : `❌ Campaign "${campaign_name}" not found for report generation.`;
        }
    }

    // Build query parameters for the report API
    const queryParams = new URLSearchParams({ type: report_type, format: validFormat });
    if (finalCampaignId) queryParams.append('cid', finalCampaignId);
    Object.entries(otherParams).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
             // Map potential argument names from Gemini to expected API query params
            const paramKey = key.startsWith('start') ? 'start_date' : key.startsWith('end') ? 'end_date' : key;
            queryParams.append(paramKey, value);
        }
    });
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''; if (!baseUrl) return lang === 'pt-BR' ? "❌ Falha na configuração interna do servidor." : "❌ Internal server configuration failure.";
    const downloadUrl = `${baseUrl}/api/download-report?${queryParams.toString()}`;
    const reportName = report_type.replace(/_/g, ' '); const formatUpper = validFormat.toUpperCase();
    return lang === 'pt-BR' ? `✅ O link para download do seu relatório '${reportName}' (formato ${formatUpper}) está pronto!\nClique aqui: [Baixar Relatório ${formatUpper}](${downloadUrl})` : `✅ Your download link for the '${reportName}' report (${formatUpper} format) is ready!\nClick here: [Download ${formatUpper} Report](${downloadUrl})`;
}

async function internalGenerateCopySuggestion(args: Partial<CopyGenerationParams>, lang: string): Promise<string> {
    if (!args.copy_type || !args.campaign_context?.name) return lang === 'pt-BR' ? '❌ Tipo de cópia e nome da campanha são necessários.' : '❌ Copy type and campaign name required.';

    // Construct a prompt for the AI to generate copy
    const creativePrompt = `Gere ${args.num_variations || 1} sugestões de texto de marketing (copy) do tipo "${args.copy_type}" para a campanha "${args.campaign_context.name}".
    ${args.campaign_context.target_audience ? `Público-alvo: ${args.campaign_context.target_audience}.` : ''}
    ${args.campaign_context.objective ? `Objetivo: ${args.campaign_context.objective}.` : ''}
    ${args.existing_cta ? (args.copy_type === 'cta_variation' ? `Baseado no CTA existente: "${args.existing_cta}".` : `Inclua CTA similar a: "${args.existing_cta}".`) : ''}
    ${args.tone ? `Use tom: ${args.tone}.` : ''}
    ${args.max_length && args.copy_type !== 'title' ? `Comprimento aproximado: ${args.max_length} caracteres.` : ''}
    Responda APENAS com o(s) texto(s) gerado(s)${(args.num_variations || 1) > 1 ? ', separados por "---".' : '.'}
    Idioma da resposta: ${lang === 'pt-BR' ? 'Português (Brasil)' : 'Inglês (EUA)'}`; // Added language hint for copy generation

    try {
        // Use a separate model instance for the creative task if needed, or reuse
        const tempGenAI = new GoogleGenerativeAI(geminiApiKey);
        const creativeModel = tempGenAI.getGenerativeModel({ model: geminiModelName }); // Reuse the same model
        const result = await creativeModel.generateContent(creativePrompt);
        const response = result.response;
        const suggestionText = response.text()?.trim();

        if (!suggestionText) return lang === 'pt-BR' ? '❌ A IA não conseguiu gerar uma sugestão desta vez.' : '❌ The AI failed to generate a suggestion this time.';
        return suggestionText;
    } catch (error: any) {
        console.error("[internalGenerateCopySuggestion] Erro Gemini para copy:", error);
        return lang === 'pt-BR' ? '❌ Erro ao gerar sugestão com a IA.' : '❌ Error generating suggestion with AI.';
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<AgentApiResponse | { error: string }>
) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const sessionId = req.headers['x-session-id'] as string || 'default-anonymous-session-' + Date.now();
    const { message, context: appContext }: RequestBody = req.body;
    if (!message || !appContext?.path) return res.status(400).json({ error: 'Bad Request: message and context.path required.' });
    // Determine user language, default to pt-BR if not specified or recognized
    const userLang = appContext.lang || (req.headers['accept-language']?.startsWith('pt') ? 'pt-BR' : 'en-US');

    let finalAgentResponseText: string = "";
    let agentAction: AgentAction | null = null;
    let currentMessageOrder = 0; // To track the order of messages in the session

    try {
        // Get the last message order to ensure new messages are sequential
        currentMessageOrder = await getLastMessageOrder(sessionId);
        // Save the user's message to the database
        await saveMessageToDB(sessionId, { role: 'user', content: message }, ++currentMessageOrder);

        // Retrieve limited history from the DB and map it to Gemini's format
        // Use the improved mapping function
        const dbHistory: DbHistoryMessage[] = await getHistoryFromDB(sessionId, MAX_HISTORY_DB_MESSAGES);
        const geminiChatHistory: Content[] = mapDbMessagesToGeminiHistory(dbHistory);

         // Log the generated history to help debug "First content should be user" errors if they persist
        console.log(`[API MCP/Gemini ${sessionId}] Mapped Gemini History:`, JSON.stringify(geminiChatHistory, null, 2));

        // Prepare the system instruction content
        const systemInstructionContent = { role: "system", parts: [{text: UBIE_SYSTEM_INSTRUCTION_TEXT(appContext.path, userLang)}]};

        // Initialize the Gemini model instance with tools and system instruction
        const modelInstance = genAI.getGenerativeModel({
            model: geminiModelName,
            tools: [{ functionDeclarations: getToolDeclarations() }],
            systemInstruction: systemInstructionContent
        });

        console.log(`[API MCP/Gemini ${sessionId}] Enviando para Gemini. Histórico (contagem): ${geminiChatHistory.length}. User: "${message.substring(0,50)}..."`);

        if (!geminiApiKey) throw new Error("GEMINI_API_KEY_INVALID");

        // Start the chat with the historical context
        // IMPORTANT: startChat requires history OR a single user message in the first sendMessage call, but not both the history AND the message if history is empty.
        // If the mapped history is empty, it implies this is the very first message, so start chat without history.
        // If history exists, start chat WITH history, and sendMessage is the NEXT turn.
        const chat = modelInstance.startChat(geminiChatHistory.length > 0 ? {
            history: geminiChatHistory, // Pass the mapped history if available
             generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
             safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        } : { // If history is empty, start chat with no history
            generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
            safetySettings: [
               { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
               { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
               { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
               { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
           ],
        });

        // Send the user message. If history was empty, this is the first turn. If history existed, this is the next turn.
        const result = await chat.sendMessage(message);
        const response = result.response;
        const candidate = response.candidates?.[0] as GenerateContentCandidate | undefined;


        console.log(`[API MCP/Gemini ${sessionId}] Gemini Raw Candidate:`, JSON.stringify(candidate, null, 2).substring(0, 700) + "...");

        let modelResponseContentForDb: string | null = null; // What the model *intended* (text or function call JSON)
        let executedToolName: string | null = null; // Name of the tool called by the model

        // Process the Gemini response candidate
        if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            let textResponseAccumulator = "";
            let functionCallToExecute = null;

            // Iterate through parts to find text or function calls
            for (const part of candidate.content.parts) {
                if (part.functionCall) {
                    functionCallToExecute = part.functionCall;
                    // Store the functionCall object JSON representation for history
                    modelResponseContentForDb = JSON.stringify(part.functionCall);
                    executedToolName = part.functionCall.name;
                    // If a function call is found, we usually stop processing other parts in this turn
                    break;
                } else if (part.text) {
                    textResponseAccumulator += part.text;
                }
            }

            // If no function call was found, the model's response is the accumulated text
            if (!functionCallToExecute && textResponseAccumulator) {
                 modelResponseContentForDb = textResponseAccumulator;
            }

            // Save the model's raw response (function call or text) to the DB
            if (modelResponseContentForDb) {
                await saveMessageToDB(sessionId, {
                    role: 'assistant', // Model responses are stored with 'assistant' role
                    content: modelResponseContentForDb,
                    name: executedToolName // 'name' is set only if it was a function call
                }, ++currentMessageOrder);
            }

            // If the model requested a function call, execute it
            if (functionCallToExecute) {
                const { name: toolName, args: toolArguments } = functionCallToExecute;
                console.log(`[API MCP/Gemini ${sessionId}] Gemini chamou ferramenta: ${toolName} com args:`, toolArguments);

                let toolExecutionResultText: string | null = null;
                try {
                    // Execute the corresponding internal function based on the tool name
                    switch (toolName) {
                        case 'navigate':
                            if (toolArguments.path && typeof toolArguments.path === 'string') {
                                agentAction = { type: 'navigate', payload: { path: toolArguments.path } };
                                toolExecutionResultText = userLang === 'pt-BR' ? `Ok, navegando para ${toolArguments.path}...` : `Okay, navigating to ${toolArguments.path}...`;
                            } else { toolExecutionResultText = userLang === 'pt-BR' ? "❌ Caminho inválido para navegação." : "❌ Invalid path for navigation."; }
                            break;
                        case 'list_campaigns':
                            toolExecutionResultText = await internalListCampaigns(toolArguments as {}, userLang);
                            break;
                        case 'get_campaign_details':
                            toolExecutionResultText = await internalGetCampaignDetails(toolArguments as { campaign_name?: string }, userLang);
                            break;
                        case 'create_campaign':
                            const createResult = await internalCreateCampaign(toolArguments as {name?:string, budget?:number}, userLang);
                            toolExecutionResultText = createResult.result;
                            if (createResult.navigateTo) agentAction = { type: 'navigate', payload: { path: createResult.navigateTo }};
                            break;
                        case 'modify_campaign':
                            toolExecutionResultText = await internalModifyCampaign(toolArguments as { identifier?: { name?: string }, fields_to_update?: any }, userLang);
                            break;
                        case 'list_available_pages':
                            toolExecutionResultText = await internalListAvailablePages(toolArguments as {}, userLang);
                            break;
                        case 'explain_feature':
                            toolExecutionResultText = await internalExplainFeature(toolArguments as { page_path?: string, element_name?: string }, userLang, appContext.path);
                            break;
                        case 'export_report':
                            toolExecutionResultText = await internalExportReport(toolArguments as { report_type?: string, format?: string, campaign_id?: string, campaign_name?: string, start_date?: string, end_date?: string }, userLang);
                            break;
                        case 'generate_copy_suggestion':
                             const copySuggestion = await internalGenerateCopySuggestion(toolArguments as Partial<CopyGenerationParams>, userLang);
                             agentAction = { type: 'copy_suggestion', payload: { suggestions: copySuggestion } }; // Return suggestions as an action
                             // Provide a simple confirmation message to the user about the suggestion
                             toolExecutionResultText = userLang === 'pt-BR' ? `✅ Aqui estão as sugestões de copy que preparei.` : `✅ Here are the copy suggestions I've prepared.`;
                             break;
                        default:
                            toolExecutionResultText = userLang === 'pt-BR' ? `❌ Ferramenta '${toolName}' desconhecida.` : `❌ Unknown tool: '${toolName}'.`;
                    }
                } catch (execError: any) {
                    console.error(`[API MCP/Gemini ${sessionId}] Erro exec ${toolName}:`, execError);
                    toolExecutionResultText = userLang === 'pt-BR' ? `❌ Erro ao executar '${toolName}'.` : `❌ Error executing '${toolName}'.`;
                }

                // The final response text to the user is the result of the tool execution
                finalAgentResponseText = toolExecutionResultText || (userLang === 'pt-BR' ? "Ação concluída." : "Action completed.");

                // Save the result of the tool execution to the DB
                await saveMessageToDB(sessionId, {
                    role: 'function', // Role 'function' for tool/function responses
                    name: toolName,    // Store the name of the tool that responded
                    content: finalAgentResponseText, // Store the textual output of the tool
                }, ++currentMessageOrder);

                 // --- Multi-turn Function Calling (Optional but recommended for fluid responses) ---
                 // After executing the tool and saving its output, send the tool's output
                 // back to the Gemini model in the *same turn* so it can generate a natural
                 // language response based on the tool's result.
                 // This requires another call to chat.sendMessage, effectively performing
                 // a second API roundtrip within this single handler execution.
                 // This makes the agent appear more "smart" as it processes the tool result
                 // before responding to the user.
                 console.log(`[API MCP/Gemini ${sessionId}] Sending tool result back to Gemini...`);
                 const toolResponseParts: Part[] = [{
                      functionResponse: {
                          name: toolName,
                          response: { name: toolName, content: finalAgentResponseText }, // Use the text result you got
                      }
                 }];

                 try {
                      const finalModelResponse = await chat.sendMessage(toolResponseParts);
                       const finalCandidate = finalModelResponse.response.candidates?.[0] as GenerateContentCandidate | undefined;

                       if (finalCandidate && finalCandidate.content && finalCandidate.content.parts && finalCandidate.content.parts.length > 0) {
                           // If the model provides a text response after the tool output
                           const finalResponseText = finalCandidate.content.parts.map(p => p.text).join('').trim();
                           if (finalResponseText) {
                                console.log(`[API MCP/Gemini ${sessionId}] Received final model response after tool: "${finalResponseText.substring(0, 100)}..."`);
                                finalAgentResponseText = finalResponseText; // Use this as the final response to the user
                                await saveMessageToDB(sessionId, { role: 'assistant', content: finalAgentResponseText }, ++currentMessageOrder);
                           } else {
                                console.warn(`[API MCP/Gemini ${sessionId}] Model provided empty text response after tool.`);
                           }
                       } else {
                           console.warn(`[API MCP/Gemini ${sessionId}] Model did not provide a final text response after tool execution.`);
                       }
                 } catch (multiTurnError: any) {
                      console.error(`[API MCP/Gemini ${sessionId}] Error in multi-turn function calling after tool execution:`, multiTurnError);
                      // Fallback: Keep the tool's result as the final response if the second turn fails
                 }
                 // --- End Multi-turn Function Calling ---


            } else if (textResponseAccumulator) {
                // If no function call, the final response is the text provided by the model
                finalAgentResponseText = textResponseAccumulator;
            } else {
                // Fallback if no text or function call was generated
                finalAgentResponseText = userLang === 'pt-BR' ? "Não obtive uma resposta clara da IA." : "Didn't get a clear response from AI.";
                if (!candidate || !candidate.content || candidate.content.parts.length === 0) {
                     console.warn(`[API MCP/Gemini ${sessionId}] Gemini não retornou 'parts' válidas na resposta.`);
                } else if (candidate.finishReason && candidate.finishReason !== "STOP") {
                     console.warn(`[API MCP/Gemini ${sessionId}] Gemini terminou com razão: ${candidate.finishReason}`);
                     finalAgentResponseText = userLang === 'pt-BR' ? `A IA terminou inesperadamente (${candidate.finishReason}). Tente novamente.` : `The AI finished unexpectedly (${candidate.finishReason}). Please try again.`;
                     if(candidate.finishReason === "SAFETY") {
                        finalAgentResponseText = userLang === 'pt-BR' ? "A resposta foi bloqueada por motivos de segurança." : "The response was blocked for safety reasons.";
                     }
                }
            }
        } else {
            // Handle cases where the response structure is completely unexpected or empty
            finalAgentResponseText = userLang === 'pt-BR' ? "Desculpe, não consegui processar sua solicitação no momento (sem resposta da IA)." : "Sorry, I couldn't process your request at the moment (no AI response).";
            console.warn(`[API MCP/Gemini ${sessionId}] Gemini não retornou candidates ou parts válidos.`);
             // Log any prompt feedback from the API
             if (response.promptFeedback) {
                console.warn(`[API MCP/Gemini ${sessionId}] Prompt Feedback:`, JSON.stringify(response.promptFeedback));
                finalAgentResponseText += userLang === 'pt-BR' ? " (Feedback do prompt recebido)" : " (Prompt feedback received)";
             }
        }

    } catch (error: any) {
        // Catch any errors during the process (DB, API call, tool execution setup)
        console.error(`[API MCP/Gemini ${sessionId}] Handler Error:`, error);
        // Provide user-friendly error messages based on the error type
        if (error.message === "GEMINI_API_KEY_INVALID") {
            finalAgentResponseText = userLang === 'pt-BR' ? "Erro de configuração da IA (Gemini)." : "AI config error (Gemini).";
        } else if (error.toString().includes("Recitation") || error.status === 400 || (error.toString().includes("SAFETY"))){
             finalAgentResponseText = userLang === 'pt-BR' ? "A IA não pôde completar a solicitação devido a restrições de conteúdo ou formato." : "The AI could not complete the request due to content or format restrictions.";
        } else if (error.message?.includes("First content should be with role 'user'")) {
             // Explicitly handle the specific Gemini history error with a helpful message
             console.error("[API MCP/Gemini Handler Error] Specific Gemini history error detected.");
             finalAgentResponseText = userLang === 'pt-BR' ?
                "Ocorreu um erro com o histórico da conversa. Por favor, tente iniciar uma nova conversa." :
                "An error occurred with the conversation history. Please try starting a new conversation.";
        }
        else {
            finalAgentResponseText = userLang === 'pt-BR' ? `Erro inesperado ao comunicar com a IA (Gemini): ${error.message || error.toString()}` : `Unexpected error communicating with AI (Gemini): ${error.message || error.toString()}`;
        }
        agentAction = null; // Clear any pending action on error

        // Attempt to save the error message to the history for visibility
        try {
            // Ensure currentMessageOrder is accurate before saving the error
            if (currentMessageOrder === 0 && sessionId) {
                 currentMessageOrder = await getLastMessageOrder(sessionId);
            }
             // Save a distinct message indicating an internal error occurred
            await saveMessageToDB(sessionId, { role: 'assistant', content: `[ERRO INTERNO DO SERVIDOR] ${finalAgentResponseText}` }, ++currentMessageOrder);
        }
        catch (saveError) { console.error(`[API MCP/Gemini ${sessionId}] Erro crítico salvar msg erro Gemini:`, saveError); }
    }

    // Ensure a response is always sent, even if empty or action-only
    if (!finalAgentResponseText && !agentAction) {
      finalAgentResponseText = userLang === 'pt-BR' ? "Sem resposta ou ação gerada." : "No response or action was generated.";
    }
    console.log(`[API MCP/Gemini ${sessionId}] Resposta Final Cliente: Response="${finalAgentResponseText.substring(0,100)}...", Action=${JSON.stringify(agentAction)}`);
    // Send the final response text and any action back to the frontend
    res.status(200).json({ response: finalAgentResponseText, action: agentAction });
}
