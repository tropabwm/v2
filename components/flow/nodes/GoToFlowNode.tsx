import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shuffle } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui
} from '../ui/FlowUIComponents';

export function GoToFlowNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [targetFlowId, setTargetFlowId] = useState(data?.targetFlowId || '');

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
                    <IconWithGlow icon={Shuffle} className="mr-1.5 h-3.5 w-3.5"/>
                    Ir para outro Fluxo
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>ID do Fluxo de Destino</NodeLabel>
                <NodeInput
                    value={targetFlowId}
                    onChange={e => {setTargetFlowId(e.target.value); update('targetFlowId', e.target.value)}}
                    placeholder="ID numérico do fluxo"
                />
            </CardContent>
            {/* Este nó não tem saída 'source', pois a execução do fluxo se move para outro lugar */}
        </Card>
    );
}
