import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Bot } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NodeTextarea,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HANDLE_GLOW_CLASSES  // <-- Importe daqui agora
} from '../ui/FlowUIComponents';

// Importe o template padrão e o tipo de dados se estiverem definidos
// import { AI_AGENT_DEFAULT_CONTEXT_TEMPLATE } from '@/lib/aiAgentDefaultContextTemplate'; // Ajuste o caminho conforme necessário
// import { AIAgentNodeData } from '@/types/zap'; // Ajuste o caminho conforme necessário

// Usando um template padrão e tipo 'any' como fallback se os imports acima não existirem/funcionarem
const AI_AGENT_DEFAULT_CONTEXT_TEMPLATE = `Você é um agente de atendimento ao cliente para [Nome da Sua Empresa].
Seu objetivo é responder perguntas sobre [Nome do Seu Curso/Produto] e direcionar o usuário para a página de vendas ou para um agente humano, se necessário.

Informações sobre o [Nome do Seu Curso/Produto]:
- Nome: [Nome Completo do Curso/Produto]
- Descrição: [Breve descrição]
- Preço: [Preço atual ou faixa de preço]
- Link da Página de Vendas: [URL]
- Tópicos que você pode responder: [Liste os tópicos principais, ex: conteúdo do curso, instrutor, forma de pagamento, garantia]
- Tópicos que você NÃO pode responder e deve transferir para um agente: [Liste os tópicos, ex: problemas técnicos, suporte pós-compra, negociação de preço]

Instruções:
1. Cumprimente o usuário calorosamente.
2. Apresente-se como o agente virtual de [Nome da Sua Empresa].
3. Pergunte como você pode ajudar em relação ao [Nome do Seu Curso/Produto].
4. Responda às perguntas do usuário com base nas informações fornecidas acima.
5. Seja conciso e direto.
6. Se a pergunta for sobre um tópico que você não pode responder, ou se o usuário pedir para falar com um humano, informe que você irá transferir para um agente especializado e use a saída 'source-transfer'.
7. Se o usuário expressar interesse em comprar ou souber a resposta para sua pergunta, forneça o link da página de vendas e use a saída 'source-response'.
8. Mantenha o tom profissional e amigável.

Variáveis disponíveis:
- {{contact.name}}: Nome do contato (se disponível)
- {{userInput}}: A última mensagem digitada pelo usuário

Exemplo de interação:
Usuário: Olá, queria saber mais sobre o curso de automação.
Você: Olá {{contact.name}}! Sou o Ubie, agente virtual da [Nome da Sua Empresa]. Posso te ajudar com informações sobre o curso de [Nome do Seu Curso/Produto]. Qual sua dúvida?
Usuário: Qual o preço?
Você: O curso custa [Preço]. Você pode ver todos os detalhes e opções de pagamento na página de vendas: [URL].
Usuário: Quero falar com um vendedor.
Você: Compreendido. Vou te transferir para um de nossos agentes. Por favor, aguarde um momento.
`;


// Usando 'any' como tipo de dados do nó para compatibilidade
export function AIAgentNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    // Usando os campos do primeiro código fornecido
    const [agentSystemContext, setAgentSystemContext] = useState(data?.agentSystemContext || AI_AGENT_DEFAULT_CONTEXT_TEMPLATE);
    const [apiKeyVariableName, setApiKeyVariableName] = useState(data?.apiKeyVariableName || '');
    const [model, setModel] = useState(data?.model || '');

    const updateNodeSpecificData = (field: string, value: any) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, [field]: value } };
            }
            return n;
        }));
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-80")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={Bot} className="mr-1.5 h-3.5 w-3.5"/>
                    Agente de IA Conversacional
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Contexto do Agente / Instrução de Sistema</NodeLabel>
                <NodeTextarea
                    value={agentSystemContext}
                    onChange={(e) => { setAgentSystemContext(e.target.value); updateNodeSpecificData('agentSystemContext', e.target.value); }}
                    placeholder="Edite o template com os detalhes do curso..."
                    rows={8}
                    className="font-mono text-[10px] leading-snug"
                />
                <NodeLabel className="mt-1.5">Nome da Variável da API Key (Opcional)</NodeLabel>
                <NodeInput
                    value={apiKeyVariableName}
                    onChange={(e) => { setApiKeyVariableName(e.target.value); updateNodeSpecificData('apiKeyVariableName', e.target.value); }}
                    placeholder="Ex: MINHA_CHAVE_API_GEMINI"
                />
                <NodeLabel className="mt-1.5">Modelo da IA (Opcional)</NodeLabel>
                <NodeInput
                    value={model}
                    onChange={(e) => { setModel(e.target.value); updateNodeSpecificData('model', e.target.value); }}
                    placeholder="gemini-1.5-flash (padrão do sistema)"
                />
            </CardContent>
             <Handle
                 type="source"
                 position={Position.Bottom}
                 id="source-response"
                 title="Resposta da IA"
                 className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-purple-500')}
             />
              <Handle
                 type="source"
                 position={Position.Right}
                 id="source-transfer"
                 style={{ top: '35%', right: '-12px' }}
                 className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-yellow-500')}
                 title="Transferir para Agente"
             />
             <Handle
                 type="source"
                 position={Position.Right}
                 id="source-error"
                 style={{ top: '65%', right: '-12px' }}
                 className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')}
                 title="Erro na IA"
             />
        </Card>
    );
}
