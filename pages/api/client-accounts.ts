// pages/api/client-accounts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ClientAccountOption } from '@/components/CampaignManagerForm'; // Ajuste o caminho se necessário

// DADOS MOCKADOS - SUBSTITUIR PELA LÓGICA REAL DE BUSCA NO DB QUANDO OAUTH ESTIVER PRONTO
const MOCK_AVAILABLE_CLIENT_ACCOUNTS: ClientAccountOption[] = [
  { id: 'client_acc_1', name: 'Loja XPTO - Google Ads', platform: 'google', platformAccountId: 'customers/1234567890' },
  { id: 'client_acc_2', name: 'Serviços ABC - Meta Ads', platform: 'meta', platformAccountId: 'act_9876543210' },
  { id: 'client_acc_3', name: 'Imobiliária Z - Google Ads', platform: 'google', platformAccountId: 'customers/1122334455' },
  { id: 'client_acc_4', name: 'Consultoria Digital - Sem Plataforma', platform: 'manual', platformAccountId: 'manual_consult' },
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClientAccountOption[] | { message: string }>
) {
  // TODO: Implementar autenticação e buscar do banco de dados real no futuro
  // const user = await verifyToken(req, res); // Exemplo de verificação de token
  // if (!user) {
  //   return res.status(401).json({ message: 'Não autorizado' });
  // }

  if (req.method === 'GET') {
    // Simular um pequeno delay de API
    await new Promise(resolve => setTimeout(resolve, 300));
    res.status(200).json(MOCK_AVAILABLE_CLIENT_ACCOUNTS);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Método ${req.method} não permitido` });
  }
}
