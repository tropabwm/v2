// pages/api/whatsapp/send.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { sendMessageToWhatsApp } from '../../../lib/whatsappSender';
import axios from 'axios';

// URL do flow controller
const FLOW_CONTROLLER_URL = process.env.FLOW_CONTROLLER_URL || 'https://flow-controller-python-production.up.railway.app';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido. Use POST.' 
    });
  }

  try {
    const { to, messagePayload } = req.body;

    // Validate required parameters
    if (!to || !messagePayload) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parâmetros obrigatórios não fornecidos: "to" e "messagePayload" são necessários.' 
      });
    }

    console.log(`[API WhatsApp send] Enviando mensagem para ${to}`);
    
    // Se for uma mensagem recebida, processá-la pelo flow controller primeiro
    if (req.body.isIncoming === true) {
      try {
        console.log(`[API WhatsApp send] Processando mensagem recebida via flow controller para ${to}`);
        
        // Enviar para o flow controller
        const flowResponse = await axios.post(`${FLOW_CONTROLLER_URL}/process_message`, {
          sender: to,
          message: typeof messagePayload.text === 'string' ? messagePayload.text : JSON.stringify(messagePayload),
          timestamp: new Date().toISOString()
        });
        
        console.log(`[API WhatsApp send] Resposta do flow controller:`, flowResponse.data);
        
        // Se o flow controller retornou uma resposta, enviá-la via WhatsApp
        if (flowResponse.data && flowResponse.data.response_payload) {
          const result = await sendMessageToWhatsApp(to, flowResponse.data.response_payload);
          
          if (result.success) {
            console.log(`[API WhatsApp send] Mensagem do flow controller enviada com sucesso para ${to}, ID: ${result.messageId}`);
            return res.status(200).json(result);
          } else {
            console.error(`[API WhatsApp send] Falha ao enviar mensagem do flow controller para ${to}: ${result.error}`);
            return res.status(500).json(result);
          }
        } else {
          // Sem resposta do flow controller, apenas confirmar recebimento
          return res.status(200).json({ success: true, message: 'Mensagem processada pelo flow controller sem resposta.' });
        }
      } catch (flowError: any) {
        console.error(`[API WhatsApp send] Erro ao processar via flow controller: ${flowError.message}`);
        // Se falhar no flow controller, tenta enviar a mensagem diretamente
      }
    }
    
    // Envio direto ou fallback se o flow controller falhar
    const result = await sendMessageToWhatsApp(to, messagePayload);
    
    if (result.success) {
      console.log(`[API WhatsApp send] Mensagem enviada com sucesso para ${to}, ID: ${result.messageId}`);
      return res.status(200).json(result);
    } else {
      console.error(`[API WhatsApp send] Falha ao enviar mensagem para ${to}: ${result.error}`);
      return res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('[API WhatsApp send] Erro ao processar requisição:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: `Erro interno: ${error.message}` 
    });
  }
}
