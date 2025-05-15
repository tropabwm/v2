// pages/api/whatsapp/reload-flow.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type ResponseData = {
  message: string;
  error?: string;
  details?: any;
  success?: boolean;
};

const FLOW_CONTROLLER_URL_ENV = process.env.FLOW_CONTROLLER_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

   if (!FLOW_CONTROLLER_URL_ENV) {
      console.error("[API Reload Flow] ERRO CRÍTICO: FLOW_CONTROLLER_URL não definida nas variáveis de ambiente.");
      return res.status(503).json({ 
        success: false, 
        message: "Serviço de controle de fluxo não configurado corretamente no servidor." 
      });
  }

  console.log(`[API Reload Flow] Solicitando recarga em: ${FLOW_CONTROLLER_URL_ENV}/reload_flow`);

  try {
      const controllerResponse = await axios.post(
        `${FLOW_CONTROLLER_URL_ENV}/reload_flow`,
        req.body || {}, 
        { timeout: 10000 }
      );

      console.log('[API Reload Flow] Resposta recebida do controller:', controllerResponse.data);
      
      if (controllerResponse.status === 200 && controllerResponse.data) {
         res.status(200).json({ 
            success: true, 
            message: controllerResponse.data?.message || 'Solicitação de recarga enviada ao controller e processada com sucesso.',
            details: controllerResponse.data?.details
        });
      } else {
        console.warn('[API Reload Flow] Resposta não esperada do controller:', controllerResponse.status, controllerResponse.data);
        res.status(controllerResponse.status || 500).json({
            success: false,
            message: 'Resposta não esperada do serviço de controle de fluxo.',
            details: controllerResponse.data
        });
      }

  } catch (error: any) {
      let errorMsg = 'Erro desconhecido ao comunicar com Flow Controller';
      let status = 503; 
      let responseData = null;

      if (axios.isAxiosError(error)) {
          status = error.response?.status || 503;
          responseData = error.response?.data;
          errorMsg = responseData?.message || responseData?.error || error.message;
           console.error(`[API Reload Flow] Erro Axios ${status} ao contatar ${FLOW_CONTROLLER_URL_ENV}/reload_flow: ${errorMsg}`, responseData);
           if (error.code === 'ECONNREFUSED') {
             errorMsg = `Conexão recusada pelo serviço de fluxo em ${FLOW_CONTROLLER_URL_ENV}. Verifique se o serviço está online e acessível.`;
             status = 503;
           } else if (error.request && !error.response) {
             errorMsg = `Nenhuma resposta recebida do serviço de fluxo em ${FLOW_CONTROLLER_URL_ENV}/reload_flow. O serviço pode estar offline ou a URL inacessível.`;
             status = 504; // Gateway Timeout
           }
      } else {
          errorMsg = error.message;
           console.error("[API Reload Flow] Erro não-Axios:", error);
      }
      res.status(status).json({ 
        success: false, 
        message: 'Erro ao comunicar com o serviço de fluxo para recarregar.', 
        error: errorMsg,
        details: responseData 
    });
  }
}
