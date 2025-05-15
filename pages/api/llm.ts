// pages/api/llm.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Log para verificar a variável de ambiente assim que o módulo é carregado
console.log("[API LLM GLOBAL SCOPE] Raw process.env.GEMINI_API_KEY:", process.env.GEMINI_API_KEY);
console.log("[API LLM GLOBAL SCOPE] GEMINI_API_KEY is defined:", !!process.env.GEMINI_API_KEY);
console.log("[API LLM GLOBAL SCOPE] Raw process.env.GEMINI_MODEL_NAME:", process.env.GEMINI_MODEL_NAME);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash-latest";

interface ChatHistoryItem {
  role: 'user' | 'model'; // Tipo estrito para role
  parts: Array<{ text: string }>;
}

// Tipo para o item do histórico vindo do frontend
interface FrontendHistoryItem {
  role: string; // Role do frontend pode ser 'user', 'assistant', etc.
  content: string;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log dentro do handler para cada requisição
  console.log("[API LLM HANDLER] Received request. Method:", req.method);
  console.log("[API LLM HANDLER] GEMINI_API_KEY from module scope:", GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 5) + "..." : "UNDEFINED");
  console.log("[API LLM HANDLER] Direct check process.env.GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "UNDEFINED");
  console.log("[API LLM HANDLER] MODEL_NAME from module scope:", MODEL_NAME);

  if (!GEMINI_API_KEY) {
    console.error("[API LLM HANDLER] GEMINI_API_KEY não está configurada no ambiente DENTRO DO HANDLER.");
    return res.status(500).json({ error: "Configuração da API de IA ausente no servidor (verificação no handler)." });
  }

  let genAIInstance: GoogleGenerativeAI | null = null;
  try {
    genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (e: any) {
    console.error("[API LLM HANDLER] Falha ao instanciar GoogleGenerativeAI:", e.message);
    return res.status(500).json({ error: "Falha ao inicializar o cliente da API de IA.", details: e.message });
  }

  const modelInstance = genAIInstance.getGenerativeModel({ 
    model: MODEL_NAME,
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ]
  });

  if (req.method === 'GET') {
    console.log("[API LLM HANDLER GET] Entrou no handler GET.");
    try {
      console.log("[API LLM HANDLER GET] Verificando a chave GEMINI_API_KEY.");
      if (!GEMINI_API_KEY) { 
          throw new Error("GEMINI_API_KEY tornou-se indefinida inesperadamente dentro do GET.");
      }
      console.log("[API LLM HANDLER GET] Health check (simples) passou. Retornando status ok.");
      return res.status(200).json({ status: 'ok', message: `API Gemini (principal em /api/llm) configurada com modelo ${MODEL_NAME}.` });
    } catch (error: any) {
      console.error("[API LLM HANDLER GET] Erro no health check:", error.message);
      return res.status(503).json({ status: 'error', error: 'API Gemini (principal em /api/llm) indisponível ou erro de configuração.', details: error.message });
    }
  }

  if (req.method === 'POST') {
    console.log("[API LLM HANDLER POST] Entrou no handler POST.");
    const {
      prompt,
      history, 
      temperature, 
      max_tokens, 
    } = req.body as { 
        prompt: string; 
        history?: FrontendHistoryItem[]; // Tipar o history do body
        temperature?: number; 
        max_tokens?: number;
    };

    console.log("[API LLM HANDLER POST] Body recebido:", { 
        prompt: prompt ? prompt.substring(0,50) + "..." : "Prompt não fornecido", 
        historyLength: history ? history.length : 0,
        temperature, 
        max_tokens 
    });

    if (!prompt) {
      console.warn("[API LLM HANDLER POST] Prompt é obrigatório e não foi fornecido.");
      return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    let geminiHistoryInput: ChatHistoryItem[] = [];
    if (history && Array.isArray(history)) {
        geminiHistoryInput = history
            .map((item: FrontendHistoryItem): ChatHistoryItem => { // Especificar o tipo de retorno do map
                const role = item.role === 'assistant' ? 'model' : 'user';
                // Aqui, o TypeScript sabe que 'role' será 'user' ou 'model'
                return {
                    role: role as ChatHistoryItem['role'], // Asserção para garantir ao TS
                    parts: [{ text: item.content || "" }]
                };
            })
            .filter(item => item.parts[0].text.trim() !== ""); 
    }
    
    const processedHistoryForGemini: ChatHistoryItem[] = [];
    if (geminiHistoryInput.length > 0) {
        let startIndex = 0;
        if (geminiHistoryInput[0].role === 'model') {
            const firstUserMsgIndex = geminiHistoryInput.findIndex(msg => msg.role === 'user');
            if (firstUserMsgIndex !== -1) {
                startIndex = firstUserMsgIndex;
            } else {
                startIndex = geminiHistoryInput.length; 
                console.warn("[API LLM HANDLER POST] Histórico continha apenas 'model', será zerado para startChat.");
            }
        }

        if (startIndex < geminiHistoryInput.length) {
            processedHistoryForGemini.push(geminiHistoryInput[startIndex]);
            for (let i = startIndex + 1; i < geminiHistoryInput.length; i++) {
                if (geminiHistoryInput[i].role !== processedHistoryForGemini[processedHistoryForGemini.length - 1].role) {
                    processedHistoryForGemini.push(geminiHistoryInput[i]);
                } else {
                    console.warn(`[API LLM HANDLER POST] Removendo mensagem consecutiva do role: ${geminiHistoryInput[i].role} no índice ${i}`);
                }
            }
        }
    }

    console.log("[API LLM HANDLER POST] Histórico final formatado para Gemini (últimas 4):", JSON.stringify(processedHistoryForGemini.slice(-4), null, 2));

    try {
      console.log(`[API LLM HANDLER POST] Chamando Gemini API (Modelo: ${MODEL_NAME}) com prompt: "${prompt.substring(0, 100)}..."`);
      
      const chat = modelInstance.startChat({
        history: processedHistoryForGemini, 
        generationConfig: {
          maxOutputTokens: max_tokens || 2000,
          temperature: temperature || 0.7, 
        }
      });

      const result = await chat.sendMessage(prompt); 
      
      if (!result.response) {
          console.error("[API LLM HANDLER POST] Resposta do Gemini não contém 'response' esperado.");
          throw new Error("Estrutura de resposta inesperada do Gemini.");
      }
      const responseText = result.response.text();
      if (typeof responseText !== 'string') {
          console.error("[API LLM HANDLER POST] Gemini response.text() não é uma string:", responseText);
          throw new Error("Conteúdo da resposta do Gemini não é texto.");
      }

      console.log(`[API LLM HANDLER POST] Resposta recebida do Gemini (primeiros 100 chars): ${responseText.substring(0,100)}...`);
      return res.status(200).json({ text: responseText });

    } catch (error: any) {
      console.error('[API LLM HANDLER POST] Erro ao chamar Gemini API:', error.response?.data || error.message || error);
      let errorMessage = 'Erro ao comunicar com a IA.';
      if (error.message) {
        errorMessage = error.message;
      }
      const errorDetails = error.errorInfo || error.customError || error.details || error.message;
      console.error(`[API LLM HANDLER POST] Detalhes do erro: ${JSON.stringify(errorDetails)}`);
      return res.status(500).json({ error: errorMessage, details: errorDetails });
    }
  }

  console.warn(`[API LLM HANDLER] Método ${req.method} não permitido para esta rota. Permitidos: GET, POST.`);
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
