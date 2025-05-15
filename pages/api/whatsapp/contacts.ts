// pages/api/whatsapp/contacts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Contact = {
    jid: string;
    name?: string;
    notify?: string;
    imgUrl?: string;
};

type ResponseData =
    | Contact[]
    | { message: string; error?: string };

const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Método ${req.method} não permitido` });
    }

     if (!BOT_API_URL) {
        console.error("[API Contacts] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
        return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor." });
    }

    console.log(`[API Contacts GET] Buscando contatos em: ${BOT_API_URL}/contacts`);

    try {
        const botResponse = await fetch(`${BOT_API_URL}/contacts`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            // Adicionar um timeout pode ser útil para não prender a requisição indefinidamente
            // signal: AbortSignal.timeout(15000) // Ex: timeout de 15 segundos
        });

        if (!botResponse.ok) {
            let errorMsg = `Erro ao buscar contatos do bot: Status ${botResponse.status}`;
            let errorDetails = null;
            try {
                const errorJson = await botResponse.json();
                errorMsg = errorJson.message || errorJson.error || errorMsg;
                errorDetails = errorJson;
            } catch (e) {}
            console.error(`[API Contacts GET] Falha na comunicação com a API do bot: ${errorMsg}`, errorDetails);
            return res.status(botResponse.status || 503).json({ message: 'Serviço do bot falhou ao buscar contatos.', error: errorMsg });
        }

        const contacts: Contact[] = await botResponse.json();
        console.log(`[API Contacts GET] Retornando ${contacts.length} contatos.`);

        res.status(200).json(contacts);

    } catch (error: any) {
        console.error("[API Contacts GET] Erro de rede ao tentar buscar contatos:", error);
        const isConnRefused = error.cause?.code === 'ECONNREFUSED'; // Node.js 18+
        // const isConnRefusedNode16 = error.code === 'ECONNREFUSED'; // Para Node.js < 18
        const finalIsConnRefused = isConnRefused; // || isConnRefusedNode16;

        const status = finalIsConnRefused ? 503 : 500;
        const message = finalIsConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro interno ao processar solicitação de contatos.';
        res.status(status).json({ message: message, error: error.message });
    }
}
