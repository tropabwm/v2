import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock10 } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils (e cores se usadas)
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HANDLE_GLOW_CLASSES  // <-- Importe daqui agora
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents

export function TimeConditionNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [startTime, setStartTime] = useState(data?.startTime || '09:00');
    const [endTime, setEndTime] = useState(data?.endTime || '18:00');

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return(
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={Clock10} className="mr-1.5 h-3.5 w-3.5"/>
                    Condição de Horário
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Horário Início (HH:MM)</NodeLabel>
                <NodeInput
                    type="time"
                    value={startTime}
                    onChange={e => {setStartTime(e.target.value); update('startTime', e.target.value)}}
                />
                <NodeLabel className="mt-1">Horário Fim (HH:MM)</NodeLabel>
                <NodeInput
                    type="time"
                    value={endTime}
                    onChange={e => {setEndTime(e.target.value); update('endTime', e.target.value)}}
                />
            </CardContent>
            <Handle
                type="source"
                position={Position.Right}
                id="source-inside"
                style={{top: '35%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}
                title="Dentro do Horário"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-outside"
                style={{top: '65%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')}
                title="Fora do Horário"
            />
        </Card>
    );
}
