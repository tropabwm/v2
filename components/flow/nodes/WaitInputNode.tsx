import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HelpCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils (e cores se usadas, como NEON_ORANGE)
import { IconWithGlow, baseCardStyle, NEON_ORANGE } from '@/components/flow/utils'; // Importe NEON_ORANGE se usado no handle de timeout
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
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents

export function WaitInputNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [variableName, setVariableName] = useState(data?.variableName || 'userInput');
    const [message, setMessage] = useState(data?.message || '');
    const [timeoutSeconds, setTimeoutSeconds] = useState<number | undefined>(data?.timeoutSeconds);

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    // Determina se o handle de timeout deve ser visível/conectável
    const isTimeoutConnectable = timeoutSeconds !== undefined && timeoutSeconds !== null && timeoutSeconds > 0;


    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={HelpCircle} className="mr-1.5 h-3.5 w-3.5"/>
                    Esperar Input
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Salvar resposta em Variável</NodeLabel>
                <NodeInput
                    value={variableName}
                    onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}}
                    placeholder="nome_da_variavel"
                />
                <NodeLabel className="mt-1">Mensagem de Solicitação (Opcional)</NodeLabel>
                <NodeTextarea
                    value={message}
                    onChange={e => {setMessage(e.target.value); update('message', e.target.value)}}
                    placeholder="Ex: Digite seu nome completo"
                />
                <NodeLabel className="mt-1">Timeout (Segundos, Opcional)</NodeLabel>
                <NodeInput
                    type="number"
                    value={timeoutSeconds ?? ''} // Use ?? '' para exibir vazio se undefined/null
                    onChange={e => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setTimeoutSeconds(val);
                        update('timeoutSeconds', val);
                    }}
                    placeholder="Ex: 60"
                    min={1}
                />
            </CardContent>
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-received"
                title="Input Recebido"
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-timeout"
                style={{ top: '65%', right: '-12px' }}
                // Usando NEON_ORANGE importado de utils
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-orange-500', !isTimeoutConnectable ? '!hidden' : '')} // Oculta se timeout não definido
                title="Timeout Atingido"
                isConnectable={isTimeoutConnectable} // Apenas conectável se timeout definido
            />
        </Card>
    );
}
