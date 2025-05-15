import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Bot, FileTerminal } from 'lucide-react';
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

// Re-incluindo campos do primeiro código para GPTQueryNode
// Se GPTQueryNodeData estiver definido em types/zap, use-o aqui
// import { GPTQueryNodeData } from '@/types/zap';

export function GPTQueryNode({ id, data }: NodeProps<any>) { // Usando 'any' ou GPTQueryNodeData
    const { setNodes } = useReactFlow();
    const [prompt, setPrompt] = useState(data?.prompt || '');
    // Re-incluindo campos do primeiro código
    const [systemMessage, setSystemMessage] = useState(data?.systemMessage || '');
    const [apiKeyVariable, setApiKeyVariable] = useState(data?.apiKeyVariable || 'OPENAI_API_KEY');
    const [saveResponseTo, setSaveResponseTo] = useState(data?.saveResponseTo || 'gptResposta');
    const [model, setModel] = useState(data?.model || 'gemini-1.5-flash-latest');
    const [temperature, setTemperature] = useState(data?.temperature ?? 0.7); // Use ?? para default 0.7
    const [maxTokens, setMaxTokens] = useState(data?.maxTokens ?? 250); // Use ?? para default 250


    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-72")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={FileTerminal} className="mr-1.5 h-3.5 w-3.5"/>
                    Consulta IA (Avançado)
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Prompt do Usuário (Use {'{{var}}'})</NodeLabel>
                <NodeTextarea
                    value={prompt}
                    onChange={e => {setPrompt(e.target.value); update('prompt', e.target.value)}}
                    placeholder="Ex: Crie uma saudação para {{nomeCliente}}."
                    rows={2}
                />
                <NodeLabel className="mt-1">Mensagem de Sistema (Opcional, Use {'{{var}}'})</NodeLabel>
                 <NodeTextarea
                     value={systemMessage}
                     onChange={e => {setSystemMessage(e.target.value); update('systemMessage', e.target.value)}}
                     placeholder="Ex: Você é um assistente prestativo."
                     rows={2}
                 />
                <NodeLabel className="mt-1">Variável da API Key</NodeLabel>
                <NodeInput
                    value={apiKeyVariable}
                    onChange={e => {setApiKeyVariable(e.target.value); update('apiKeyVariable', e.target.value)}}
                    placeholder="Ex: MINHA_CHAVE_OPENAI"
                />
                <NodeLabel className="mt-1">Salvar Resposta em Variável</NodeLabel>
                <NodeInput
                    value={saveResponseTo}
                    onChange={e => {setSaveResponseTo(e.target.value); update('saveResponseTo', e.target.value)}}
                    placeholder="variavel_resposta_gpt"
                />
                <NodeLabel className="mt-1">Modelo (Opcional)</NodeLabel>
                <NodeInput
                    value={model}
                    onChange={e => {setModel(e.target.value); update('model', e.target.value)}}
                    placeholder="gemini-1.5-flash-latest"
                />
                 <div className="grid grid-cols-2 gap-1.5 mt-1">
                     <div>
                         <NodeLabel>Temperatura (0-2)</NodeLabel>
                         <NodeInput
                             type="number"
                             step="0.1"
                             min="0"
                             max="2"
                             value={temperature}
                             onChange={e => {
                                 const val = parseFloat(e.target.value);
                                 setTemperature(val);
                                 update('temperature', val);
                             }}
                         />
                     </div>
                     <div>
                         <NodeLabel>Max Tokens</NodeLabel>
                         <NodeInput
                             type="number"
                             step="10"
                             min="1"
                             value={maxTokens}
                             onChange={e => {
                                 const val = parseInt(e.target.value);
                                 setMaxTokens(val);
                                 update('maxTokens', val);
                             }}
                         />
                     </div>
                 </div>
            </CardContent>
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-success"
                title="Sucesso"
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-error"
                style={{ top: '50%', right: '-12px' }}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')}
                title="Erro na Consulta"
            />
        </Card>
    );
}
