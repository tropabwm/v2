// pages/api/whatsapp/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
    status: string;
    qrCodeString?: string | null;
    message?: string;
};

const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | { message: string; error?: string; status?: string }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Método ${req.method} não permitido` });
    }

    if (!BOT_API_URL) {
        console.error("[API Status] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
        return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor.", status: "error" });
    }

    console.log(`[API Status] Buscando status em: ${BOT_API_URL}/status`);

    try {
        const botResponse = await fetch(`${BOT_API_URL}/status`, {
             method: 'GET',
             headers: { 'Accept': 'application/json' }
        });

        if (!botResponse.ok) {
            let errorMsg = `Erro ao buscar status do bot: Status ${botResponse.status}`;
            let errorDetails = null;
            try {
                const errorJson = await botResponse.json();
                errorMsg = errorJson.message || errorJson.error || errorMsg;
                errorDetails = errorJson;
            } catch (e) {
                 errorMsg = `${errorMsg} - ${botResponse.statusText}`;
            }
            console.error(`[API Status] Falha na comunicação: ${errorMsg}`, errorDetails);
            return res.status(botResponse.status || 503).json({
                message: "Falha ao obter status do serviço WhatsApp.",
                error: errorMsg,
                status: "error"
            });
        }

        const botData = await botResponse.json();
        console.log("[API Status] Status recebido do bot:", botData);

        res.status(200).json({
            status: botData.status || 'unknown',
            qrCodeString: botData.qrCode || botData.qrCodeString || null,
            message: botData.message
        });

    } catch (error: any) {
        console.error("[API Status] Erro de rede ao obter status:", error);
        const isConnRefused = error.cause?.code === 'ECONNREFUSED';
        const status = isConnRefused ? 503 : 500;
        const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro ao comunicar com o serviço WhatsApp.';
        res.status(status).json({ message: message, error: error.message, status: "error" });
    }
}
