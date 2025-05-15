// lib/whatsappBot.js
const {
    makeWASocket,
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    isJidUser,
    jidNormalizedUser,
    MessageType, // Para tipos de mensagem antigos, se necessário
    MessageOptions, // Para tipos de mensagem antigos, se necessário
    Mimetype, // Para tipos de mídia
    proto // Para construir mensagens complexas
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { spawn } = require('child_process'); // Para o displayQrScript.js (opcional)

// --- Configurações ---
const SESSION_DIR = path.resolve(__dirname, '..', 'auth_info_baileys'); // Nome da pasta de sessão
const API_PORT = parseInt(process.env.WHATSAPP_BOT_INTERNAL_PORT || '3001', 10);
const NEXTJS_WEBHOOK_URL = process.env.NEXTJS_WEBHOOK_URL; // Ex: https://seuapp.up.railway.app/api/whatsapp/webhook
const DISPLAY_QR_SCRIPT_PATH = path.join(__dirname, '..', 'displayQrScript.js'); // Caminho para o script que mostra o QR
const MAX_CONNECTION_RETRIES = 5; // Máximo de tentativas de reconexão rápida
const RETRY_DELAY_MS = 15000; // 15 segundos

let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected'; // disconnected, connecting, connected, logging_out
let connectionRetryTimeout = null;
let globalResolveConnectPromise = null;
let connectionRetries = 0;
let lastDisconnectReason = null;

const contactsCache = new Map();

// --- Logger Pino Config ---
const pinoOptions = { level: process.env.LOG_LEVEL || 'info' };
if (process.env.NODE_ENV === 'development') {
    try {
        const prettyTarget = require.resolve('pino-pretty');
        pinoOptions.transport = { target: prettyTarget, options: { colorize: true, ignore: 'pid,hostname' } };
    } catch (err) { console.warn("pino-pretty não encontrado, usando log JSON padrão."); }
}
const logger = pino(pinoOptions);

// --- Funções Internas ---
const getQrCodeInternal = () => qrCodeData;
const getConnectionStatusInternal = () => ({
    status: connectionStatus,
    qrCode: qrCodeData, // Retorna o QR code junto com o status
    lastDisconnectReason: lastDisconnectReason,
    retries: connectionRetries
});

function getContactsFromCacheInternal() {
    const contactsArray = Array.from(contactsCache.values())
        .filter(c => c.jid) // Garante que tem JID
        .sort((a, b) => (a.name || a.notify || a.jid).localeCompare(b.name || b.notify || b.jid));
    return contactsArray;
}

function updateContactsCache(newOrUpdatedContacts) {
    if (!Array.isArray(newOrUpdatedContacts)) return;
    let updatedCount = 0; let newCount = 0;
    newOrUpdatedContacts.forEach(contact => {
        if (contact && contact.id && isJidUser(contact.id)) {
            const jid = jidNormalizedUser(contact.id);
            const existingContact = contactsCache.get(jid);
            const formattedContact = {
                jid: jid,
                name: contact.name || undefined,
                notify: contact.notify || undefined,
                imgUrl: contact.imgUrl || undefined // Tenta pegar imgUrl se disponível
            };
            if (!existingContact || JSON.stringify(existingContact) !== JSON.stringify(formattedContact)) {
                if (existingContact) { updatedCount++; } else { newCount++; }
                contactsCache.set(jid, formattedContact);
            }
        }
    });
    if (newCount > 0 || updatedCount > 0) { logger.info(`[CONTACTS CACHE] Cache atualizado: ${newCount} novos, ${updatedCount} atualizados. Total: ${contactsCache.size}`); }
}

function displayQrInExternalScript(qrString) {
    if (!fs.existsSync(DISPLAY_QR_SCRIPT_PATH)) {
        logger.warn(`[QR DISPLAY] Script ${DISPLAY_QR_SCRIPT_PATH} não encontrado. Exibindo QR no console.`);
        qrcode.generate(qrString, { small: true });
        return;
    }
    try {
        logger.info(`[QR DISPLAY] Tentando exibir QR Code em script externo: ${DISPLAY_QR_SCRIPT_PATH}`);
        const qrProcess = spawn('node', [DISPLAY_QR_SCRIPT_PATH, qrString], { stdio: 'inherit' });
        qrProcess.on('error', (err) => {
            logger.error('[QR DISPLAY] Falha ao iniciar script externo para QR Code:', err);
            qrcode.generate(qrString, { small: true }); // Fallback para o console
        });
    } catch (e) {
        logger.error('[QR DISPLAY] Exceção ao tentar script externo para QR Code:', e);
        qrcode.generate(qrString, { small: true }); // Fallback
    }
}

const ensureSessionDirExists = () => { if (!fs.existsSync(SESSION_DIR)) { fs.mkdirSync(SESSION_DIR, { recursive: true }); logger.info(`[SYS] Diretório de sessão criado: ${SESSION_DIR}`); } };

async function sendWhatsAppMessageInternal(jid, messageOptions) {
    if (!sock || connectionStatus !== 'connected') {
        logger.warn(`[WPP SEND] Falha ao enviar para ${jid}. Bot não conectado (Status: ${connectionStatus})`);
        throw new Error(`Bot not connected (status: ${connectionStatus})`);
    }
    if (!isJidUser(jid)) {
        logger.warn(`[WPP SEND] JID inválido fornecido: ${jid}`);
        throw new Error(`Invalid JID: ${jid}`);
    }
    if (typeof messageOptions !== 'object' || messageOptions === null) {
        logger.warn(`[WPP SEND] 'messageOptions' inválido para ${jid}:`, messageOptions);
        throw new Error('Message options must be an object.');
    }

    try {
        logger.info(`[WPP SEND] Tentando enviar para ${jid}. Opções: ${JSON.stringify(messageOptions)}`);
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        // Pequeno delay para simular digitação e garantir que a presença seja enviada
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

        const sentMsg = await sock.sendMessage(jid, messageOptions);

        await sock.sendPresenceUpdate('paused', jid);
        logger.info(`[WPP SEND] Mensagem enviada para ${jid}. ID da mensagem: ${sentMsg?.key?.id}`);
        return { success: true, messageId: sentMsg?.key?.id, details: sentMsg };
    } catch (error) {
        logger.error(`[WPP SEND] Erro ao enviar mensagem para ${jid}:`, error);
        // Tenta fornecer mais detalhes do erro se for um erro do Baileys
        const errorMessage = error.message || 'Erro desconhecido ao enviar mensagem.';
        throw new Error(`Failed to send message to ${jid}: ${errorMessage}`);
    }
}

const clearConnectionRetry = () => { if (connectionRetryTimeout) { clearTimeout(connectionRetryTimeout); connectionRetryTimeout = null; } };

const scheduleConnectionRetry = (delay = RETRY_DELAY_MS) => {
    clearConnectionRetry();
    if (connectionStatus === 'connected' || connectionStatus === 'logging_out' || connectionRetries >= MAX_CONNECTION_RETRIES) {
        if (connectionRetries >= MAX_CONNECTION_RETRIES) {
            logger.warn(`[CONN] Máximo de ${MAX_CONNECTION_RETRIES} tentativas de reconexão atingido. Desistindo até nova solicitação manual.`);
        }
        return;
    }
    connectionRetryTimeout = setTimeout(() => {
        if (connectionStatus !== 'connected' && connectionStatus !== 'logging_out') {
            connectionRetries++;
            logger.warn(`[CONN] Tentando reconectar (tentativa ${connectionRetries}/${MAX_CONNECTION_RETRIES})...`);
            connectToWhatsApp().catch(err => logger.error("[CONN] Falha na tentativa de reconexão agendada:", err));
        }
    }, delay);
    logger.info(`[CONN] Tentativa de reconexão agendada em ${delay / 1000}s.`);
};

async function disconnectWhatsApp(manualLogout = false) {
    logger.info(`[CONN] Desconexão solicitada (Manual: ${manualLogout}). Status atual: ${connectionStatus}`);
    clearConnectionRetry();
    contactsCache.clear(); logger.info('[CONTACTS CACHE] Cache de contatos limpo.');

    if (!sock) {
        logger.info('[CONN] Socket já é nulo. Garantindo estado desconectado.');
        connectionStatus = 'disconnected';
        qrCodeData = null;
        lastDisconnectReason = 'Socket nulo na desconexão.';
        return { success: true, message: 'Já estava desconectado ou socket nulo.' };
    }

    const currentSock = sock;
    sock = null; // Define sock como null imediatamente para evitar novas operações

    if (manualLogout) {
        connectionStatus = 'logging_out';
        logger.info('[CONN] Realizando logout manual...');
        try {
            await currentSock.logout();
            logger.info('[CONN] Logout realizado com sucesso no Baileys.');
            if (fs.existsSync(SESSION_DIR)) {
                logger.info(`[SYS] Removendo diretório de sessão: ${SESSION_DIR}`);
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                logger.info(`[SYS] Sessão ${SESSION_DIR} removida com sucesso.`);
            }
        } catch (err) {
            logger.error('[CONN] Erro durante logout manual do Baileys:', err);
            // Mesmo com erro, força a limpeza da sessão se existir
            if (fs.existsSync(SESSION_DIR)) {
                logger.warn(`[SYS] Forçando remoção da sessão ${SESSION_DIR} após erro no logout.`);
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            }
        } finally {
            connectionStatus = 'disconnected';
            qrCodeData = null;
            lastDisconnectReason = 'Logout manual solicitado.';
        }
    } else {
        logger.info('[CONN] Encerrando conexão local (sem logout completo)...');
        try {
            // currentSock.end(new Error('Desconexão local solicitada pelo sistema')); // Pode não ser necessário/funcionar
            logger.info('[CONN] Conexão local marcada para encerramento.');
        } catch (err) {
            logger.error('[CONN] Erro ao tentar encerrar conexão local (currentSock.end):', err);
        } finally {
            connectionStatus = 'disconnected';
            qrCodeData = null;
            lastDisconnectReason = 'Desconexão local solicitada (não manual).';
        }
    }

    if (currentSock?.ev) {
        currentSock.ev.removeAllListeners();
        logger.info('[CONN] Listeners de eventos removidos do socket antigo.');
    }

    if (globalResolveConnectPromise) {
        globalResolveConnectPromise({ success: false, message: 'Conexão interrompida durante inicialização.' });
        globalResolveConnectPromise = null;
    }
    logger.info(`[CONN] Estado final após desconexão: ${connectionStatus}`);
    return { success: true, message: `Desconexão processada. Status: ${connectionStatus}` };
}

async function connectToWhatsApp() {
    if (connectionStatus === 'connected') {
        logger.info('[CONN] Já conectado.');
        return Promise.resolve({ success: true, sock: sock, message: 'Já conectado.' });
    }
    if (connectionStatus === 'connecting') {
        logger.warn('[CONN] Conexão já em andamento.');
        // Se uma promessa de conexão anterior existe, retorna ela ou uma nova.
        return globalResolveConnectPromise ?
            new Promise(resolve => globalResolveConnectPromise = resolve) :
            Promise.resolve({ success: false, message: 'Conexão já em andamento, aguarde.' });
    }

    logger.info('[CONN] Iniciando nova conexão com WhatsApp...');
    connectionStatus = 'connecting';
    qrCodeData = null;
    lastDisconnectReason = null;
    ensureSessionDirExists();
    clearConnectionRetry();
    // connectionRetries = 0; // Reseta contador de retries AQUI, ao iniciar uma *nova* tentativa de conexão

    return new Promise(async (resolve) => {
        globalResolveConnectPromise = resolve;

        try {
            const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            logger.info(`[SYS] Usando Baileys v${version.join('.')}. É a última versão? ${isLatest}`);

            const newSock = makeWASocket({
                version,
                logger: logger.child({ class: 'baileys' }),
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.ubuntu('Chrome'),
                shouldIgnoreJid: jid => !isJidUser(jid),
                syncFullHistory: false,
                markOnlineOnConnect: true,
                getMessage: async key => {
                    // logger.debug('[MSG STORE] getMessage chamado para key:', key);
                    return undefined;
                }
            });

            // --- Gerenciamento de Eventos do Socket ---
            newSock.ev.on('creds.update', saveCreds);

            newSock.ev.on('contacts.upsert', contacts => { logger.info(`[EVENT] contacts.upsert: ${contacts.length} contatos.`); updateContactsCache(contacts); });
            newSock.ev.on('contacts.set', ({ contacts }) => { logger.info(`[EVENT] contacts.set: ${contacts.length} contatos. Cache reiniciado.`); contactsCache.clear(); updateContactsCache(contacts); });


            newSock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr: newQr } = update;
                logger.info(`[CONN UPDATE] Estado: ${connection || 'N/A'}, QR: ${!!newQr}, LastDisconnect: ${JSON.stringify(lastDisconnect)}`);

                if (newQr) {
                    qrCodeData = newQr;
                    connectionStatus = 'connecting';
                    logger.info('[CONN] QR Code recebido. Use /status para obtê-lo ou veja o console/script externo.');
                    if (process.env.DISPLAY_QR_METHOD === 'script') {
                        displayQrInExternalScript(newQr);
                    } else {
                        qrcode.generate(newQr, { small: true });
                    }
                }

                if (connection === 'close') {
                    qrCodeData = null;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                                            statusCode !== DisconnectReason.connectionReplaced &&
                                            statusCode !== 401; // 401 Unauthorized

                    lastDisconnectReason = `Código: ${statusCode || 'N/A'}, Erro: ${lastDisconnect?.error?.message || lastDisconnect?.error || 'Desconhecido'}`;
                    logger.error(`[CONN] Conexão fechada! ${lastDisconnectReason}`);

                    if (connectionStatus !== 'logging_out') {
                        connectionStatus = 'disconnected';
                    }
                    contactsCache.clear(); logger.info('[CONTACTS CACHE] Cache de contatos limpo devido à conexão fechada.');

                    if (globalResolveConnectPromise) {
                        globalResolveConnectPromise({ success: false, message: `Conexão fechada: ${lastDisconnectReason}` });
                        globalResolveConnectPromise = null;
                    }

                    if (shouldReconnect) {
                        logger.info('[CONN] Tentará reconectar...');
                        scheduleConnectionRetry();
                    } else {
                        logger.warn(`[CONN] Desconexão permanente (Código ${statusCode}). Limpando sessão e não reconectando automaticamente.`);
                        await disconnectWhatsApp(true); // Força logout e limpeza da sessão
                    }
                } else if (connection === 'open') {
                    qrCodeData = null;
                    connectionStatus = 'connected';
                    connectionRetries = 0;
                    clearConnectionRetry();
                    sock = newSock;
                    logger.info('[CONN] WhatsApp conectado com sucesso!');

                    if (sock.store && sock.store.contacts) {
                        logger.info('[CONN OPEN] Populando cache de contatos com sock.store.contacts...');
                        updateContactsCache(Object.values(sock.store.contacts));
                    } else {
                        logger.warn('[CONN OPEN] sock.store.contacts não disponível. Cache será populado por eventos.');
                    }

                    if (globalResolveConnectPromise) {
                        globalResolveConnectPromise({ success: true, sock: sock, message: 'Conectado com sucesso.' });
                        globalResolveConnectPromise = null;
                    }
                }
            });

            newSock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;
                const msg = messages[0];

                if (!msg.message || msg.key.fromMe || !isJidUser(msg.key.remoteJid)) {
                    return;
                }

                const senderJid = jidNormalizedUser(msg.key.remoteJid);
                let userMessageText = '';

                if (msg.message.conversation) {
                    userMessageText = msg.message.conversation;
                } else if (msg.message.extendedTextMessage?.text) {
                    userMessageText = msg.message.extendedTextMessage.text;
                } else if (msg.message.buttonsResponseMessage?.selectedButtonId) {
                    userMessageText = msg.message.buttonsResponseMessage.selectedButtonId;
                } else if (msg.message.listResponseMessage?.singleSelectReply?.selectedRowId) {
                    userMessageText = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
                } else {
                    logger.info(`[MSG EVENT] Recebido tipo de mensagem não textual/interativo de ${senderJid}. Ignorando para webhook.`);
                    return;
                }

                if (!userMessageText.trim()) {
                    logger.info(`[MSG EVENT] Mensagem vazia de ${senderJid} ignorada.`);
                    return;
                }

                logger.info(`[MSG EVENT] Mensagem recebida de ${senderJid}: "${userMessageText}"`);

                if (!NEXTJS_WEBHOOK_URL) {
                    logger.error("[MSG EVENT] ERRO CRÍTICO: NEXTJS_WEBHOOK_URL não definida. Não é possível encaminhar mensagem.");
                    return;
                }

                try {
                    logger.info(`[MSG EVENT] Enviando para Webhook Next.js (${NEXTJS_WEBHOOK_URL})...`);
                    const response = await fetch(NEXTJS_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sender_id: senderJid, message: userMessageText }),
                        // signal: AbortSignal.timeout(15000) // Timeout de 15s
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        logger.error(`[MSG EVENT] Erro ao enviar para Webhook Next.js (Status: ${response.status}): ${errorBody}`);
                    } else {
                        logger.info(`[MSG EVENT] Mensagem de ${senderJid} encaminhada para o webhook com sucesso (Status: ${response.status}).`);
                    }
                } catch (error) {
                    logger.error(`[MSG EVENT] Falha catastrófica ao enviar para Webhook Next.js:`, error);
                }
            });

        } catch (error) {
            logger.fatal('[CONN] Erro fatal durante a inicialização do makeWASocket:', error);
            connectionStatus = 'disconnected';
            qrCodeData = null;
            lastDisconnectReason = `Erro na inicialização: ${error.message}`;
            if (globalResolveConnectPromise) {
                globalResolveConnectPromise({ success: false, message: `Erro fatal na inicialização: ${error.message}` });
                globalResolveConnectPromise = null;
            }
            if (sock && sock.ev) sock.ev.removeAllListeners();
            sock = null;
            contactsCache.clear();
        }
    });
}


// --- Servidor API Interno ---
const apiServer = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const method = req.method; // Captura o método
    const pathname = parsedUrl.pathname; // Captura o pathname

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    logger.info(`[API INTERNA] Recebida: ${method} ${pathname}`);
    // Adiciona logs de depuração para entender a comparação
    logger.debug(`[API INTERNA] Comparando método: '${method}' === 'GET' -> ${method === 'GET'}`);
    logger.debug(`[API INTERNA] Comparando método: '${method}' === 'POST' -> ${method === 'POST'}`);
    logger.debug(`[API INTERNA] Comparando pathname: '${pathname}' === '/status' -> ${pathname === '/status'}`);
    logger.debug(`[API INTERNA] Comparando pathname: '${pathname}' === '/connect' -> ${pathname === '/connect'}`);
    logger.debug(`[API INTERNA] Comparando pathname: '${pathname}' === '/disconnect' -> ${pathname === '/disconnect'}`);
    logger.debug(`[API INTERNA] Comparando pathname: '${pathname}' === '/contacts' -> ${pathname === '/contacts'}`);
    logger.debug(`[API INTERNA] Comparando pathname: '${pathname}' === '/send' -> ${pathname === '/send'}`);


    try {
        if (method === 'GET' && pathname === '/status') {
            logger.debug('[API INTERNA] Rota matched: /status GET');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getConnectionStatusInternal()));
        }
        else if (method === 'POST' && pathname === '/connect') {
             logger.debug('[API INTERNA] Rota matched: /connect POST'); // Este log deve aparecer se a rota corresponder
            if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: `Conexão já está ${connectionStatus}.`, ...getConnectionStatusInternal() }));
            } else {
                connectionRetries = 0;
                connectToWhatsApp().catch(err => logger.error("[API /connect] Erro ao iniciar conexão via API:", err));
                res.writeHead(202, { 'Content-Type': 'application/json' }); // Accepted
                res.end(JSON.stringify({ message: 'Solicitação de conexão recebida. Monitore /status para QR code e estado.' }));
            }
        }
        else if (method === 'POST' && pathname === '/disconnect') {
             logger.debug('[API INTERNA] Rota matched: /disconnect POST');
            const result = await disconnectWhatsApp(true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: result.message, status: connectionStatus }));
        }
        else if (method === 'GET' && pathname === '/contacts') {
             logger.debug('[API INTERNA] Rota matched: /contacts GET');
            const contacts = getContactsFromCacheInternal();
            logger.info(`[API INTERNA /contacts] Retornando ${contacts.length} contatos do cache.`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(contacts));
        }
        else if (method === 'POST' && pathname === '/send') {
             logger.debug('[API INTERNA] Rota matched: /send POST');
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(body);
                    const { jid, options } = parsedBody;
                    if (!jid || !options) {
                        logger.warn('[API INTERNA /send] Requisição inválida, faltando jid ou options:', parsedBody);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: 'JID e options (contendo a mensagem) são obrigatórios.' }));
                    }
                    const result = await sendWhatsAppMessageInternal(jid, options);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    logger.error(`[API INTERNA /send] Erro ao processar envio:`, error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message || 'Erro interno ao enviar mensagem.' }));
                }
            });
        }
        else {
            // Este bloco é atingido se nenhuma das condições acima for TRUE
            logger.warn(`[API INTERNA] Endpoint NÃO ENCONTRADO nos handlers: ${method} ${pathname}`);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Endpoint não encontrado nesta API interna do bot.' }));
        }
    } catch (error) {
        logger.error(`[API INTERNA ${method} ${pathname}] Erro inesperado:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Erro interno do servidor no bot.', error: error.message }));
    }
});

// --- Inicialização e Graceful Shutdown ---
if (require.main === module) {
    if (!NEXTJS_WEBHOOK_URL) {
        logger.fatal("[SYS] ERRO CRÍTICO: A variável de ambiente NEXTJS_WEBHOOK_URL não está definida. O bot não poderá encaminhar mensagens. Encerrando.");
        process.exit(1);
    }
    logger.info('[SYS] Iniciando bot WhatsApp e servidor API interno...');
    // Tenta conectar na inicialização. Não bloqueia o início do servidor API.
    connectToWhatsApp().catch(err => logger.error("[SYS] Falha na tentativa de conexão inicial automática:", err));

    apiServer.listen(API_PORT, '0.0.0.0', () => { // Escuta em 0.0.0.0 para Railway
        logger.info(`[SYS] Servidor API interno do bot escutando em http://0.0.0.0:${API_PORT}`);
    }).on('error', (err) => {
        logger.fatal(`[SYS] Falha ao iniciar servidor API na porta ${API_PORT}:`, err);
        process.exit(1);
    });

    const gracefulShutdown = async (signal) => {
        logger.info(`[SYS] Sinal ${signal} recebido. Encerrando bot e servidor...`);
        clearConnectionRetry();
        await disconnectWhatsApp(false).catch(err => logger.error('[SYS] Erro durante desconexão no shutdown:', err));
        logger.info('[SYS] Fechando servidor API interno...');
        apiServer.close(() => {
            logger.info('[SYS] Servidor API interno parado.');
            setTimeout(() => { logger.info('[SYS] Encerrando processo.'); process.exit(0); }, 500); // Pequeno delay para logs finais
        });
        // Timeout para forçar o encerramento se o graceful shutdown demorar muito
        setTimeout(() => { logger.warn('[SYS] Timeout no graceful shutdown! Forçando encerramento do processo.'); process.exit(1); }, 10000);
    };
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown); // Railway usa SIGTERM
}

// Exporta funções se este módulo for importado por outro (geralmente não é o caso para este bot)
module.exports = {
    connectToWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus: getConnectionStatusInternal, // Para uso interno ou testes
    sendWhatsAppMessage: sendWhatsAppMessageInternal, // Para uso interno ou testes
    getContacts: getContactsFromCacheInternal, // Para uso interno ou testes
};
