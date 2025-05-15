// pages/api/copy-suggestions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerateContentRequest } from '@google/generative-ai'; // Importado GenerateContentRequest
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash-latest";

interface CampaignContext {
    name?: string | null;
    objective?: any | null; 
    target_audience?: string | null;
}

interface CopySuggestionRequest {
    copyType: 'title' | 'body' | 'caption' | 'cta_variation' | string; 
    campaignId?: string | null;
    existingTitle?: string | null;
    existingBody?: string | null;
    existingCaption?: string | null;
    existingCta?: string | null;
    targetAudience?: string | null; 
    tone?: string; 
    numVariations?: number;
    customInstructions?: string | null;
}

interface SuggestionApiResponse {
    suggestions?: string[];
    rawResponse?: string; 
    error?: string;
    details?: any;
}

async function fetchCampaignDetails(campaignId: string, apiBaseUrl: string, token: string | undefined): Promise<CampaignContext | null> {
    if (!campaignId || !apiBaseUrl ) { 
        console.warn("[API CopySuggestions] fetchCampaignDetails: campaignId ou apiBaseUrl ausente.");
        return null;
    }
    try {
        console.log(`[API CopySuggestions] Fetching campaign details for ID: ${campaignId}`);
        const headers: any = {};
        if (token) { 
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Adicionado log da URL completa
        const fullCampaignApiUrl = `${apiBaseUrl}/api/campaigns?id=${campaignId}`;
        console.log(`[API CopySuggestions] Calling campaign API: ${fullCampaignApiUrl}`);
        const response = await axios.get(fullCampaignApiUrl, {
            headers: headers,
            timeout: 10000
        });
        if (response.status === 200 && response.data) {
            const campData = response.data;
            const objective = campData.objective ? (Array.isArray(campData.objective) ? campData.objective.join(', ') : String(campData.objective)) : 'Não definido';
            return {
                name: campData.name,
                objective: objective,
                target_audience: campData.targetAudience, // Corrigido para targetAudience (schema da API)
            };
        }
        return null;
    } catch (error: any) {
        console.error(`[API CopySuggestions] Error fetching campaign details for ${campaignId}:`, error.response?.data || error.message);
        return null;
    }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuggestionApiResponse>
) {
    console.log(`[API CopySuggestions] Received request. Method: ${req.method}`);
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    if (!GEMINI_API_KEY) {
        console.error("[API CopySuggestions] GEMINI_API_KEY não está configurada.");
        return res.status(500).json({ error: "Configuração da API de IA ausente no servidor." });
    }

    const {
        copyType,
        campaignId,
        existingTitle,
        existingBody,
        existingCaption,
        existingCta,
        targetAudience, 
        tone = 'persuasivo', 
        numVariations = 1,
        customInstructions
    }: CopySuggestionRequest = req.body;

    const authorizationHeader = req.headers.authorization;
    let apiToken: string | undefined = undefined;
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        apiToken = authorizationHeader.substring(7);
        console.log("[API CopySuggestions] Token recebido do frontend:", apiToken ? apiToken.substring(0,10)+"..." : "Nenhum token no header");
    } else {
        console.warn("[API CopySuggestions] Nenhum header Authorization Bearer token encontrado na requisição.");
        // Considerar retornar 401 se o token for estritamente necessário para buscar contexto de campanha
        // if (campaignId) return res.status(401).json({ error: "Não autorizado: Token ausente para buscar contexto de campanha." });
    }

    let campaignContext: CampaignContext | null = null;
    const internalApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (req.headers.host ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}` : 'http://localhost:3000');
    console.log("[API CopySuggestions] Usando internalApiBaseUrl:", internalApiBaseUrl);


    if (campaignId && apiToken) { 
        campaignContext = await fetchCampaignDetails(campaignId, internalApiBaseUrl, apiToken);
    } else if (campaignId && !apiToken) {
        console.warn(`[API CopySuggestions] campaignId ${campaignId} fornecido, mas sem token para buscar detalhes.`);
    }
    
    if (!campaignContext && targetAudience) { 
        campaignContext = { target_audience: targetAudience };
    }

    let prompt = `Você é Ubie, um copywriter especialista em marketing digital e criação de conteúdo persuasivo.\n`;
    prompt += `Gere ${numVariations} variação(ões) para um(a) "${copyType}" com tom "${tone}".\n`;

    if (campaignContext) {
        prompt += "\nConsidere o seguinte contexto de campanha:\n";
        if (campaignContext.name) prompt += `- Nome da Campanha: ${campaignContext.name}\n`;
        if (campaignContext.objective) prompt += `- Objetivo Principal: ${campaignContext.objective}\n`;
        if (campaignContext.target_audience) prompt += `- Público-Alvo: ${campaignContext.target_audience}\n`;
    } else if (targetAudience) {
         prompt += `\nO público-alvo principal é: ${targetAudience}\n`;
    }

    if (copyType === 'title') {
        if(existingBody) prompt += `\nO corpo principal da copy existente é: "${existingBody.substring(0, 200)}..."\n`;
        if(existingCaption) prompt += `\nA legenda existente é: "${existingCaption.substring(0, 150)}..."\n`;
        prompt += `Crie títulos curtos, impactantes e que gerem curiosidade.\n`;
    } else if (copyType === 'body') {
        if(existingTitle) prompt += `\nO título existente é: "${existingTitle}"\n`;
        if(existingCta) prompt += `\nO Call to Action (CTA) existente é: "${existingCta}"\n`;
        prompt += `Desenvolva o corpo do texto conectando-se com as dores e desejos do público, apresentando a solução e benefícios, e levando ao CTA.\n`;
    } else if (copyType === 'caption') {
        if(existingTitle) prompt += `\nO título relacionado é: "${existingTitle}"\n`;
        if(existingBody) prompt += `\nO corpo principal da copy existente é: "${existingBody.substring(0, 200)}..."\n`;
        if(existingCta) prompt += `\nO Call to Action (CTA) é: "${existingCta}"\n`;
        prompt += `Crie uma legenda engajadora para redes sociais, que complemente o conteúdo visual e incentive a interação ou o clique no CTA. Use emojis relevantes se apropriado.\n`;
    } else if (copyType === 'cta_variation') {
        if (!existingCta) {
            return res.status(400).json({ error: "CTA existente é necessário para gerar variações." });
        }
        prompt += `\nO Call to Action (CTA) atual é: "${existingCta}".\n`;
        prompt += `Gere variações criativas e eficazes para este CTA, mantendo o mesmo objetivo.\n`;
    }

    if (customInstructions) {
        prompt += `\nInstruções Adicionais do Usuário: ${customInstructions}\n`;
    }
    prompt += "\n---\nSugestão(ões):";

    try {
        console.log(`[API CopySuggestions] Prompt final para Gemini (primeiros 300 chars): ${prompt.substring(0,300)}...`);
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_NAME,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });
        
        // *** CORREÇÃO APLICADA AQUI ***
        const request: GenerateContentRequest = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7, 
                maxOutputTokens: copyType === 'body' || copyType === 'caption' ? 1500 : 500,
                // Adicione topK, topP aqui se necessário
            }
        };
        // Removido o segundo argumento de generateContent, pois a config já está no primeiro.
        const result = await model.generateContent(request); 
        const response = result.response;
        const responseText = response.text();

        console.log(`[API CopySuggestions] Resposta crua do Gemini: ${responseText.substring(0, 200)}...`);
        
        const suggestions = responseText.split('\n').map(s => s.replace(/^(-|\*)\s*/, '').trim()).filter(s => s.length > 0);

        res.status(200).json({ suggestions: suggestions.length > 0 ? suggestions : [responseText], rawResponse: responseText });

    } catch (error: any) {
        console.error('[API CopySuggestions] Erro ao chamar Gemini API:', error.response?.data || error.message || error);
        res.status(500).json({ error: 'Falha ao gerar sugestões de cópia.', details: error.message });
    }
}
