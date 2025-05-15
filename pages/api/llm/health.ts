// pages/api/llm/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ status: string; message?: string }> // Adicionado message opcional
) {
  if (req.method === 'GET') {
    // Simplesmente retorna 200 OK se a API estiver rodando
    // Você pode adicionar uma verificação da GEMINI_API_KEY aqui também se quiser
    if (process.env.GEMINI_API_KEY) {
        res.status(200).json({ status: 'ok', message: 'API LLM (Gemini) configurada e rota de health acessível.' });
    } else {
        res.status(503).json({ status: 'error', message: 'Variável GEMINI_API_KEY não encontrada no servidor.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
