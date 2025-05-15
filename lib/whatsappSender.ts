// lib/whatsappSender.ts
import axios, { AxiosError } from 'axios';

// URL base da sua API de Bot do WhatsApp. Deve ser configurada via variável de ambiente.
const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

// Interface para as opções de mensagem que podem ser enviadas.
// Esta estrutura é o que o flow_controller.py deve gerar
// e o que a API do seu bot (whatsappBot.js) espera receber dentro de 'options'.
export interface SendMessageOptions {
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'list' | 'location';
    text?: string;
    image?: { url: string; caption?: string };
    audio?: { url: string; caption?: string; ptt?: boolean }; // Adicionado ptt e caption
    video?: { url: string; caption?: string };
    document?: { url: string; filename?: string; mimetype?: string; caption?: string };
    buttons?: {
        text: string;
        buttons: Array<{ buttonId: string; buttonText: { displayText: string }; type: number }>;
        footerText?: string;
        headerType?: number; // Ex: 1 para TEXT, 0 para EMPTY. Veja Baileys proto.Message.ButtonsMessage.HeaderType
    };
    list?: {
        text: string; // Descrição principal da lista
        buttonText: string; // Texto do botão que abre a lista
        title?: string; // Título da própria lista (opcional, mas bom ter)
        sections: Array<{ title: string; rows: Array<{ rowId: string; title: string; description?: string }> }>;
        footerText?: string;
    };
    location?: {
        degreesLatitude: number;
        degreesLongitude: number;
        name?: string;
        address?: string;
    };
    // Não precisa de [key: string]: any; aqui se SendMessageOptions for estritamente o que o bot espera.
    // O 'type' já está definido acima.
}

// Interface para o resultado do envio da mensagem retornado pela API do bot.
export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    details?: any;
}

// Interface para a estrutura de dados de erro que pode ser retornada pela API do bot no corpo da resposta.
interface BotApiErrorData {
    success: boolean;
    message?: string;
    error?: string;
    details?: any;
}

export async function sendMessageToWhatsApp(jid: string, options: SendMessageOptions): Promise<SendResult> {
    if (!BOT_API_URL) {
        const criticalError = "[whatsappSender] ERRO CRÍTICO: A variável de ambiente WHATSAPP_BOT_URL não está definida.";
        console.error(criticalError);
        return {
            success: false,
            error: "Configuração do servidor incompleta: URL da API do bot não definida."
        };
    }

    const sendUrl = `${BOT_API_URL.replace(/\/$/, '')}/send`;

    // **CORREÇÃO APLICADA AQUI:**
    // O whatsappBot.js espera um payload { jid: "...", options: { ... } }
    const requestPayload = {
        jid: jid,       // Corrigido de 'to' para 'jid'
        options: options  // Corrigido de 'messagePayload' para 'options'
    };

    console.log(`[whatsappSender] Enviando POST para: ${sendUrl}`);
    console.log(`[whatsappSender] Payload CORRIGIDO (requestPayload):`, JSON.stringify(requestPayload, null, 2));


    try {
        const response = await axios.post<SendResult>(sendUrl, requestPayload, { // Enviando requestPayload corrigido
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000 // Timeout de 20 segundos
        });

        console.log(`[whatsappSender] Resposta recebida da API do Bot (${response.status}) para JID ${jid}:`, JSON.stringify(response.data, null, 2));

        if (response.data && typeof response.data.success === 'boolean') {
            return {
                success: response.data.success,
                messageId: response.data.messageId,
                error: !response.data.success ? (response.data.error || 'A API do Bot reportou falha sem mensagem de erro específica.') : undefined,
                details: response.data.details
            };
        } else {
            console.warn(`[whatsappSender] Resposta da API do Bot em ${sendUrl} para JID ${jid} não continha um campo "success" booleano claro ou era inesperada. Status HTTP: ${response.status}. Data:`, response.data);
            const isSuccessHttpStatus = response.status >= 200 && response.status < 300;
            return {
                success: isSuccessHttpStatus,
                messageId: response.data?.messageId,
                error: isSuccessHttpStatus ? undefined : `Resposta inesperada da API do bot (Status HTTP: ${response.status})`,
                details: response.data
            };
        }
    } catch (error: any) {
        let errorMessage = 'Erro desconhecido ao tentar comunicar com a API do bot.';
        let errorDetails: any = null;
        let statusCode: number | string | undefined = 'N/A';

        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<BotApiErrorData>;
            errorMessage = axiosError.message;
            errorDetails = axiosError.response?.data || null;

            if (axiosError.response?.data) {
                errorMessage = axiosError.response.data.error || axiosError.response.data.message || errorMessage;
            }
            
            if (axiosError.response) {
                statusCode = axiosError.response.status;
                if (statusCode === 404) {
                    errorMessage = `Endpoint não encontrado (${sendUrl}) na API do bot. Verifique se a rota está correta e se o método POST é suportado. (Status: ${statusCode})`;
                } else if (statusCode === 401 || statusCode === 403) {
                    errorMessage = `Não autorizado ou proibido de acessar o endpoint ${sendUrl} (Status: ${statusCode}). Verifique as credenciais ou permissões.`;
                } else if (statusCode >= 400 && statusCode < 500) { // Erro 400 (Bad Request) cairá aqui
                    errorMessage = `Erro do cliente ao chamar API do bot em ${sendUrl} (Status: ${statusCode}). Mensagem do bot: ${errorMessage}`;
                } else if (statusCode >= 500) {
                    errorMessage = `Erro no servidor da API do bot em ${sendUrl} (Status: ${statusCode}). ${errorMessage}`;
                }
            } else if (axiosError.request) {
                statusCode = axiosError.code || 'No Response';
                if (axiosError.code === 'ECONNREFUSED') {
                    errorMessage = `Conexão recusada pela API do bot em ${sendUrl}. Verifique se o serviço do bot está online e acessível.`;
                } else if (axiosError.code === 'ETIMEDOUT') {
                    errorMessage = `Timeout (limite de tempo excedido) ao tentar comunicar com a API do bot em ${sendUrl}.`;
                } else {
                     errorMessage = `Nenhuma resposta recebida da API do bot em ${sendUrl}. Código: ${axiosError.code || 'desconhecido'}. ${errorMessage}`;
                }
            } else {
                errorMessage = `Erro ao configurar a requisição para ${sendUrl}: ${axiosError.message}`;
                statusCode = 'Request Setup Error';
            }
        } else {
            errorMessage = error.message || 'Ocorreu um erro inesperado.';
            errorDetails = error;
            statusCode = 'Non-Axios Error';
        }

        console.error(`[whatsappSender] Falha ao chamar a API do Bot em ${sendUrl} para JID ${jid}. Status/Code: ${statusCode}, Erro: ${errorMessage}`, errorDetails ? JSON.stringify(errorDetails) : '');
        return {
            success: false,
            error: `Falha na comunicação com o bot: ${errorMessage}`, // Mensagem mais genérica para o frontend
            details: errorDetails // Mantém detalhes para logging ou depuração mais profunda
        };
    }
}

export interface BotStatusResponse {
    status: string;
    qrCode?: string | null; // Opcional, pois pode não estar sempre presente
    qrCodeString?: string | null; // Adicionado para consistência se o bot enviar como string
    message?: string;
    lastDisconnectReason?: any;
    retries?: number;
    [key: string]: any; // Permite outros campos que o bot possa retornar
}

export async function checkBotConnection(): Promise<BotStatusResponse> {
    if (!BOT_API_URL) {
        const criticalError = "[whatsappSender] ERRO CRÍTICO: A variável de ambiente WHATSAPP_BOT_URL não está definida.";
        console.error(criticalError);
        return { status: 'error', message: "Configuração do servidor incompleta: URL da API do bot não definida." };
    }

    const statusUrl = `${BOT_API_URL.replace(/\/$/, '')}/status`;
    console.log(`[whatsappSender] Verificando status da conexão do bot em: ${statusUrl}`);

    try {
        const response = await axios.get<BotStatusResponse>(statusUrl, {
            timeout: 10000 // Timeout de 10 segundos
        });

        console.log(`[whatsappSender] Status do Bot (${response.status}):`, JSON.stringify(response.data, null, 2));
        
        // Normaliza para qrCodeString, pois é o que a UI parece esperar
        const qr = response.data.qrCode || response.data.qrCodeString || response.data.qr;

        return {
            ...response.data, // Retorna todos os outros campos como estão
            qrCodeString: qr,
            qrCode: undefined // Limpa qrCode para evitar duplicidade se qrCodeString for usado
        };
    } catch (error: any) {
        let errorMessage = 'Erro desconhecido ao tentar obter o status do bot.';
        let statusCode: number | string | undefined = 'N/A';

        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<BotApiErrorData>;
            errorMessage = axiosError.message;
            if (axiosError.response?.data) {
                errorMessage = axiosError.response.data.message || axiosError.response.data.error || errorMessage;
            }

            if (axiosError.response) {
                statusCode = axiosError.response.status;
                if (statusCode === 404) errorMessage = `Endpoint de status não encontrado (${statusUrl}). (Status: ${statusCode})`;
            } else if (axiosError.request) {
                statusCode = axiosError.code || 'No Response';
                if (axiosError.code === 'ECONNREFUSED') errorMessage = `Conexão recusada pela API do bot em ${statusUrl}.`;
                else if (axiosError.code === 'ETIMEDOUT') errorMessage = `Timeout ao tentar obter o status do bot em ${statusUrl}.`;
                else errorMessage = `Nenhuma resposta de ${statusUrl}. Código: ${axiosError.code || 'desconhecido'}. ${errorMessage}`;
            } else {
                errorMessage = `Erro ao configurar requisição para ${statusUrl}: ${axiosError.message}`;
                statusCode = 'Request Setup Error';
            }
        } else {
            errorMessage = error.message || 'Ocorreu um erro inesperado ao obter status.';
            statusCode = 'Non-Axios Error';
        }
        console.error(`[whatsappSender] Não foi possível obter o status do bot de ${statusUrl}. Status/Code: ${statusCode}, Erro: ${errorMessage}`);
        return { status: 'error', message: errorMessage };
    }
}
