import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Repeat } from 'lucide-react';
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

export function LoopNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [repetitions, setRepetitions] = useState(data?.repetitions || 3);

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return(
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={Repeat} className="mr-1.5 h-3.5 w-3.5"/>
                    Loop (Repetir)
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Número de Repetições</NodeLabel>
                <NodeInput
                    type="number"
                    value={repetitions}
                    onChange={e => {const val = parseInt(e.target.value) || 1; setRepetitions(val); update('repetitions', val)}}
                    min={1}
                />
            </CardContent>
            <Handle
                type="source"
                position={Position.Right}
                id="source-loop-body"
                style={{top: '35%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-blue-500')}
                title="Executar Corpo do Loop"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-finished"
                style={{top: '65%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-gray-500')}
                title="Loop Finalizado"
            />
        </Card>
    );
}
