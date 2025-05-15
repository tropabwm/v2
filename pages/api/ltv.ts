// pages/api/ltv.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql'; // Removida initializeCampaignsTable da importação
import mysql from 'mysql2/promise';

interface LtvInputs {
    avgTicket: number;
    purchaseFrequency: number; // Ex: 1.5 vezes por mês
    customerLifespan: number;  // Em meses
}

interface LtvData {
    inputs: LtvInputs;
    result: number; // LTV calculado
    source: 'default' | 'campaign'; // Indica a origem dos dados
}

const DEFAULT_AVG_TICKET = 100;
const DEFAULT_PURCHASE_FREQUENCY = 1.5; // vezes por período (ex: mês)
const DEFAULT_CUSTOMER_LIFESPAN = 12;   // período (ex: meses)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LtvData | { message: string; error?: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Método ${req.method} Não Permitido` });
  }

  let dbPool: mysql.Pool | null = null; // dbPool é do tipo Pool
  // Não é necessário obter uma conexão individual (dbConnection) para uma simples query de leitura
  // O pool pode executar queries diretamente.

  try {
    dbPool = getDbPool();
    if (!dbPool) {
        console.error("[API /api/ltv] Falha crítica: Pool de conexão MySQL não disponível.");
        return res.status(503).json({ message: "Serviço de banco de dados indisponível.", error: "DB_POOL_UNAVAILABLE" });
    }

    // Assumimos que initializeAllTables() já foi chamado na inicialização do servidor.
    // Não chamamos initializeCampaignsTable() aqui.

    const { campaignId } = req.query;
    console.log(`[API /api/ltv] GET Req: campaignId=${campaignId}`);

    let inputs: LtvInputs = {
        avgTicket: DEFAULT_AVG_TICKET,
        purchaseFrequency: DEFAULT_PURCHASE_FREQUENCY,
        customerLifespan: DEFAULT_CUSTOMER_LIFESPAN,
    };
    let dataSource: LtvData['source'] = 'default';

    if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') {
        console.log(`[API /api/ltv] Buscando dados da campanha ID: ${campaignId}`);
        // Seleciona apenas as colunas relevantes para LTV da tabela campaigns
        const sql = 'SELECT avgTicket, purchaseFrequency, customerLifespan FROM campaigns WHERE id = ? LIMIT 1';
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(sql, [campaignId]);

        if (rows.length > 0) {
            const campaignData = rows[0];
            console.log(`[API /api/ltv] Dados encontrados para campanha ${campaignId}:`, campaignData);
            
            // Use os dados do banco OU os defaults se os campos forem NULL ou inválidos no banco
            const dbAvgTicket = parseFloat(campaignData.avgTicket);
            const dbPurchaseFrequency = parseFloat(campaignData.purchaseFrequency);
            const dbCustomerLifespan = parseInt(campaignData.customerLifespan, 10);

            inputs = {
                avgTicket: !isNaN(dbAvgTicket) ? dbAvgTicket : DEFAULT_AVG_TICKET,
                purchaseFrequency: !isNaN(dbPurchaseFrequency) ? dbPurchaseFrequency : DEFAULT_PURCHASE_FREQUENCY,
                customerLifespan: !isNaN(dbCustomerLifespan) ? dbCustomerLifespan : DEFAULT_CUSTOMER_LIFESPAN,
            };
            dataSource = 'campaign';
        } else {
            console.warn(`[API /api/ltv] Campanha ${campaignId} não encontrada no DB. Usando valores padrão.`);
            // Mantém os valores padrão e a fonte como 'default'
        }
    } else if (campaignId === 'manual') {
        console.log(`[API /api/ltv] Modo manual, esperando inputs do query ou usando defaults.`);
        // Para modo manual, permite que o frontend envie os inputs via query string
        // Se não enviados, usa os defaults.
        const queryAvgTicket = req.query.avgTicket ? parseFloat(req.query.avgTicket as string) : NaN;
        const queryPurchaseFrequency = req.query.purchaseFrequency ? parseFloat(req.query.purchaseFrequency as string) : NaN;
        const queryCustomerLifespan = req.query.customerLifespan ? parseInt(req.query.customerLifespan as string, 10) : NaN;

        inputs = {
            avgTicket: !isNaN(queryAvgTicket) ? queryAvgTicket : DEFAULT_AVG_TICKET,
            purchaseFrequency: !isNaN(queryPurchaseFrequency) ? queryPurchaseFrequency : DEFAULT_PURCHASE_FREQUENCY,
            customerLifespan: !isNaN(queryCustomerLifespan) ? queryCustomerLifespan : DEFAULT_CUSTOMER_LIFESPAN,
        };
        dataSource = 'default'; // Ainda considera default, pois não veio de uma campanha específica do DB
    } else {
         console.log(`[API /api/ltv] Usando valores padrão (campaignId 'all', não fornecido, ou inválido).`);
         // Mantém os valores padrão e a fonte como 'default'
    }

    // Calcula o LTV
    // LTV = (Ticket Médio * Frequência de Compra por período) * Tempo de Vida do Cliente em períodos
    // Ex: (R$100 * 1.5 compras/mês) * 12 meses = R$1800
    const ltvResult = (inputs.avgTicket || 0) * (inputs.purchaseFrequency || 0) * (inputs.customerLifespan || 0);

    const responseData: LtvData = {
        inputs: {
            avgTicket: parseFloat(Number(inputs.avgTicket).toFixed(2)),
            purchaseFrequency: parseFloat(Number(inputs.purchaseFrequency).toFixed(1)), // 1 casa decimal para frequência
            customerLifespan: inputs.customerLifespan, // Mantém como inteiro
         },
        result: parseFloat(ltvResult.toFixed(2)),
        source: dataSource,
    };

    res.status(200).json(responseData);

  } catch (error: any) {
    console.error("[API /api/ltv] Erro:", error);
    res.status(500).json({ message: `Erro Interno no Servidor: ${error.message || 'Erro desconhecido ao calcular LTV.'}`, error: error.code });
  }
  // O pool é gerenciado globalmente, não precisa de dbPool.release() aqui se usou dbPool.query()
}
