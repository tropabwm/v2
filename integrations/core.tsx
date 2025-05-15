// integrations/core.tsx
import { z } from 'zod';
import axios from 'axios';

const LLMInputSchema = z.object({
  prompt: z.string(),
  temperature: z.number().optional().default(0.7),
  maxTokens: z.number().optional(),
  response_json_schema: z.any().optional(),
  context: z.object({
      path: z.string().default('/')
  }).optional().default({ path: '/'}),
  lastActionContext: z.any().optional().nullable()
});

const LLMOutputSchema = z.object({
    response: z.string(),
    action: z.object({
        type: z.string(),
        payload: z.any().optional()
    }).optional().nullable()
});

type InvokeLLMResponse = {
    textResponse: string;
    jsonResponse: any;
    action?: { type: string; payload?: any } | null;
};

type LLMInput = z.infer<typeof LLMInputSchema>;

export const InvokeLLM = async (input: LLMInput): Promise<InvokeLLMResponse> => {
  try {
    const validatedInput = LLMInputSchema.parse(input);
    console.log("[InvokeLLM] Chamando API do Agente MCP...");

    const apiPayload = {
        message: `Gere insights em formato JSON estrito que valide contra a seguinte schema: ${JSON.stringify(validatedInput.response_json_schema || {})} com base em: ${validatedInput.prompt}`,
        context: validatedInput.context,
        lastActionContext: validatedInput.lastActionContext,
        response_json_schema: validatedInput.response_json_schema,
    };

    const response = await axios.post<z.infer<typeof LLMOutputSchema>>('/api/mcp-agent', apiPayload);
    console.log("[InvokeLLM] Resposta da API do Agente MCP recebida.");

    const apiResponse = LLMOutputSchema.parse(response.data);

    let jsonResponse = null;
    let textResponse = apiResponse.response;

    if (validatedInput.response_json_schema) {
        try {
            const possibleJson = JSON.parse(apiResponse.response);
            jsonResponse = possibleJson;
        } catch (e) {
            console.warn("[InvokeLLM] Resposta da API não pôde ser parseada como JSON:", apiResponse.response, "Erro:", e);
            jsonResponse = null;
        }
    }

    let actionResult: { type: string; payload?: any } | null = null;
    if (apiResponse.action && typeof apiResponse.action.type === 'string') {
        actionResult = {
            type: apiResponse.action.type,
            payload: apiResponse.action.payload
        };
    }


    return {
        textResponse: textResponse,
        jsonResponse: jsonResponse,
        action: actionResult
    };

  } catch (error: any) {
      console.error("[InvokeLLM] Erro ao invocar LLM via API:", error);
      return {
          textResponse: `Erro ao se comunicar com o assistente IA: ${error.message || 'Erro desconhecido'}. Verifique os logs do backend.`,
          jsonResponse: null,
          action: null
      };
  }
};
