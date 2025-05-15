// pages/api/ai/query.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai";

interface AIQueryRequestBody {
    prompt: string;
    apiKey: string; // API Key do Gemini fornecida pelo Flow Controller
    systemMessage?: string; // Para Gemini, isso pode ser parte do histórico inicial
    model?: string;         // Ex: "gemini-pro" ou "gemini-1.0-pro" ou "gemini-1.5-flash"
    temperature?: number;
    maxTokens?: number;     // Gemini usa maxOutputTokens
    // Adicionar outros parâmetros específicos do Gemini se necessário
}

interface AIQueryResponse {
    success: boolean;
    response?: string | null;
    message?: string;
    details?: any;
}

// Configurações de segurança padrão (ajuste conforme necessário)
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<AIQueryResponse>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Método ${req.method} não permitido. Use POST.` });
    }

    const {
        prompt,
        apiKey, // Chave da API Gemini
        systemMessage,
        model = 'gemini-1.5-flash-latest', // Modelo Gemini padrão (Flash é mais rápido e custo-efetivo)
        temperature = 0.7,
        maxTokens = 500, // Gemini usa maxOutputTokens
    } = req.body as AIQueryRequestBody;

    console.log(`[API AI Query - Gemini] Recebido POST para /api/ai/query`);
    console.log(`[API AI Query - Gemini] Prompt recebido (início): "${String(prompt).substring(0, 100)}..."`);
    console.log(`[API AI Query - Gemini] Modelo: ${model}, Temperatura: ${temperature}, MaxOutputTokens: ${maxTokens}`);
    console.log(`[API AI Query - Gemini] API Key recebida: ${apiKey ? 'Sim' : 'Não'}`); // Não logue a chave
     if (systemMessage) {
        console.log(`[API AI Query - Gemini] System Message (usado como histórico inicial): "${String(systemMessage).substring(0,100)}..."`);
    }

    if (!prompt) {
        return res.status(400).json({ success: false, message: 'O campo "prompt" é obrigatório.' });
    }
    if (!apiKey) {
        return res.status(400).json({ success: false, message: 'O campo "apiKey" (chave da API do Gemini) é obrigatório.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({
            model: model,
            safetySettings: safetySettings,
        });

        const generationConfig: GenerationConfig = {
            temperature: Number(temperature),
            maxOutputTokens: Number(maxTokens),
            // topK, topP podem ser adicionados aqui se desejado
        };

        // Para Gemini, a systemInstruction pode ser o primeiro turno da conversa
        // ou usando a propriedade `systemInstruction` no `getGenerativeModel` (para modelos mais novos)
        // Por simplicidade, vamos adicionar a systemMessage como parte do histórico se presente.
        const chatHistory: Content[] = [];
        if (systemMessage && typeof systemMessage === 'string' && systemMessage.trim() !== '') {
            // Simula uma instrução de sistema como o primeiro turno do usuário, e uma resposta "ok" do modelo
            chatHistory.push({ role: "user", parts: [{ text: systemMessage }] });
            chatHistory.push({ role: "model", parts: [{ text: "Entendido. Como posso ajudar?" }] }); // Resposta modelo genérica
        }
        
        console.log(`[API AI Query - Gemini] Enviando requisição para o modelo Gemini: ${model}...`);

        // Se houver histórico (systemMessage), inicia um chat
        if (chatHistory.length > 0) {
            const chat = geminiModel.startChat({
                history: chatHistory,
                generationConfig: generationConfig,
            });
            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            const aiResponseText = response.text()?.trim();

            if (aiResponseText === undefined || aiResponseText === null) {
                console.warn('[API AI Query - Gemini] Resposta da IA foi undefined ou null.');
                return res.status(200).json({ success: true, response: null, message: "A IA (Gemini) não forneceu uma resposta textual." });
            }
            console.log(`[API AI Query - Gemini] Resposta da IA processada (início): "${aiResponseText.substring(0, 100)}..."`);
            return res.status(200).json({ success: true, response: aiResponseText });

        } else {
            // Se não houver systemMessage, faz uma consulta direta
            const result = await geminiModel.generateContent({
                contents: [{ role: "user", parts: [{text: prompt}]}],
                generationConfig: generationConfig,
            });
            const response = await result.response;
            const aiResponseText = response.text()?.trim();

            if (aiResponseText === undefined || aiResponseText === null) {
                console.warn('[API AI Query - Gemini] Resposta da IA foi undefined ou null.');
                return res.status(200).json({ success: true, response: null, message: "A IA (Gemini) não forneceu uma resposta textual." });
            }
            console.log(`[API AI Query - Gemini] Resposta da IA processada (início): "${aiResponseText.substring(0, 100)}..."`);
            return res.status(200).json({ success: true, response: aiResponseText });
        }

    } catch (error: any) {
        console.error('[API AI Query - Gemini] Erro ao chamar API do Gemini ou processar a resposta:', error);
        let userErrorMessage = 'Falha ao consultar o modelo de IA (Gemini).';
        let errorDetails: any = { message: error.message, code: error.code };

        // A API do Gemini pode retornar erros com uma estrutura específica
        if (error.message && error.message.includes("API key not valid")) {
            userErrorMessage = "API Key do Gemini inválida. Verifique a chave fornecida.";
        } else if (error.status === 'PERMISSION_DENIED' || (error.details && error.details.includes('PERMISSION_DENIED'))) {
            userErrorMessage = "Permissão negada para usar a API Gemini. Verifique as configurações da sua chave e do projeto Google Cloud.";
        } else if (error.message && error.message.includes("billing")){
            userErrorMessage = "Problema de faturamento com a API Gemini. Verifique sua conta Google Cloud.";
        }

        return res.status(500).json({
            success: false,
            message: userErrorMessage,
            details: errorDetails
        });
    }
}