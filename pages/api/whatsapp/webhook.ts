// /pages/api/whatsapp/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sendMessageToWhatsApp } from '@/lib/whatsappSender'; 
import axios from 'axios'; 

// Obtém a URL base do Flow Controller das variáveis de ambiente
const FLOW_CONTROLLER_BASE_URL = process.env.FLOW_CONTROLLER_URL; 
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto'; 

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Webhook] Received request:', req.method, req.url);

  if (req.method === 'GET') {
    console.log('[Webhook GET] Request query:', req.query);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook GET] Verification successful.');
      res.status(200).send(challenge);
    } else {
      console.warn('[Webhook GET] Verification failed.');
      res.status(403).send('Forbidden');
    }
    return;
  }

  if (req.method === 'POST') {
    const body = req.body;
    console.log('[Webhook POST] Request body:', JSON.stringify(body, null, 2));

    const senderId = body?.sender_id; 
    const messageText = body?.message;

    if (!senderId || typeof senderId !== 'string' || !senderId.includes('@')) {
        console.warn('[Webhook POST] Ignorando: sender_id inválido ou ausente.', senderId);
        return res.status(200).send('EVENT_RECEIVED_INVALID_SENDER');
    }
    if (typeof messageText !== 'string' || messageText.trim() === '') {
        // Permitir messageText vazio se for um clique em botão/lista que não envia texto
        // O bot Baileys envia o 'selectedButtonId' ou 'selectedRowId' no corpo
        // O flow_controller precisa saber lidar com isso.
        // Por agora, vamos permitir, o flow_controller que decida.
        console.log('[Webhook POST] Mensagem de texto vazia ou inválida, pode ser um clique de botão/lista.');
    }
    
    console.log(`[Webhook POST] Mensagem/interação de ${senderId}: "${messageText}" (ou clique)`);

    if (!FLOW_CONTROLLER_BASE_URL) {
        console.error('[Webhook POST] ERRO CRÍTICO: FLOW_CONTROLLER_URL não está definido nas variáveis de ambiente do Next.js!');
        // Não enviar mensagem de erro de volta para o WhatsApp neste caso, pois é um erro de config.
        return res.status(200).send('EVENT_RECEIVED_CONFIG_ERROR'); // Responde OK para o WhatsApp
    }

    // Constrói a URL completa para o endpoint /process_message
    const targetUrl = `${FLOW_CONTROLLER_BASE_URL.replace(/\/$/, '')}/process_message`;

    try {
      console.log(`[Webhook POST] Enviando para Flow Controller (${targetUrl})...`);
      
      // O payload para o flow_controller pode precisar de mais dados se o bot Baileys os enviar
      // Ex: tipo de mensagem (se for botão, qual o ID do botão clicado, etc.)
      // No momento, estamos enviando apenas sender_id e message.
      // Se o seu bot Baileys (valiant-hope) envia mais campos, adicione-os aqui.
      const payloadToController = {
        sender_id: senderId,
        message: messageText, // Pode ser o texto da mensagem ou o ID do botão/lista clicado
        // Adicione outros campos que seu bot Baileys envia e que o flow_controller espera:
        // selectedButtonId: body?.selectedButtonId, 
        // selectedRowId: body?.selectedRowId,
        // message_type: body?.message_type (ex: 'interactive')
      };
      // Filtra chaves com valor undefined para não enviar "selectedButtonId": undefined
      Object.keys(payloadToController).forEach(key => payloadToController[key as keyof typeof payloadToController] === undefined && delete payloadToController[key as keyof typeof payloadToController]);


      const flowResponse = await axios.post(targetUrl, payloadToController, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000 // Aumentado para 20 segundos
      });

      console.log(`[Webhook POST] Resposta do Flow Controller (${flowResponse.status}):`, JSON.stringify(flowResponse.data, null, 2));

      if (flowResponse.status !== 200) {
          console.error(`[Webhook POST] Erro do Flow Controller (${flowResponse.status}):`, flowResponse.data);
          return res.status(200).send('EVENT_RECEIVED_CONTROLLER_ERROR'); 
      }

      const flowData = flowResponse.data;

      if (flowData.response_payload && typeof flowData.response_payload === 'object' && Object.keys(flowData.response_payload).length > 0) {
         console.log(`[Webhook POST] Enviando resposta via whatsappSender para ${senderId}:`, flowData.response_payload);
         const sendResult = await sendMessageToWhatsApp(senderId, flowData.response_payload); 
         if (sendResult.success) {
            console.log('[Webhook POST] Mensagem enviada com sucesso via whatsappSender.');
         } else {
            console.error('[Webhook POST] Falha ao enviar mensagem via whatsappSender:', sendResult.error);
         }
      } else {
         console.log('[Webhook POST] Flow Controller não retornou mensagem de resposta (response_payload) ou payload vazio.');
      }

      return res.status(200).send('EVENT_RECEIVED');

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro desconhecido';
      const errorStatus = error.response?.status;
      console.error(`[Webhook POST] Erro (${errorStatus || 'sem status'}) ao processar mensagem ou comunicar com Flow Controller: ${errorMsg}`);
      if(error.response?.data){
        console.error("[Webhook POST] Detalhes do erro do controller:", JSON.stringify(error.response.data, null, 2));
      }
      return res.status(200).send('EVENT_RECEIVED_INTERNAL_ERROR');
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
