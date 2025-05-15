import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogOut } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow, baseCardStyle e NEON_RED de utils
import { IconWithGlow, baseCardStyle, NEON_RED } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui neste nó
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents


export function EndFlowNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [reason, setReason] = useState(data?.reason || '');

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48 !border-red-500/50")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={cn(NODE_HEADER_CLASSES, "!text-red-400")}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={LogOut} className="mr-1.5 h-3.5 w-3.5" color={NEON_RED}/>
                    Encerrar Fluxo
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Motivo do Encerramento (Opcional)</NodeLabel>
                <NodeInput
                    value={reason}
                    onChange={e => {setReason(e.target.value); update('reason', e.target.value)}}
                    placeholder="Ex: Cliente satisfeito"
                />
            </CardContent>
            {/* Este nó não tem saída 'source', pois ele encerra o fluxo */}
        </Card>
    );
}
