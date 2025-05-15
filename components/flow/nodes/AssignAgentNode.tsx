import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserCheck } from 'lucide-react';
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
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui
} from '../ui/FlowUIComponents';

export function AssignAgentNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [department, setDepartment] = useState(data?.department || '');
    const [message, setMessage] = useState(data?.message || '');

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={UserCheck} className="mr-1.5 h-3.5 w-3.5"/>
                    Atribuir a Agente
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Departamento (Opcional)</NodeLabel>
                <NodeInput
                    value={department}
                    onChange={e => {setDepartment(e.target.value); update('department', e.target.value)}}
                    placeholder="Ex: Vendas, Suporte"
                />
                <NodeLabel className="mt-1">Mensagem para Agente (Opcional)</NodeLabel>
                <NodeTextarea
                    value={message}
                    onChange={e => {setMessage(e.target.value); update('message', e.target.value)}}
                    placeholder="Contexto para o agente..."
                />
            </CardContent>
            {/* Este nó não tem saída 'source', pois a conversa é transferida */}
        </Card>
    );
}
