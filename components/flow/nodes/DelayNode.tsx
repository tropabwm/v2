import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils (e cores se usadas)
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NodeSelect,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui neste nó
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents
import { SelectItem } from '@/components/ui/select'; // Importe SelectItem

export function DelayNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [duration, setDuration] = useState(data?.duration || 1);
    const [unit, setUnit] = useState<'seconds' | 'minutes'>(data?.unit || 'seconds');

    const updateNodeData = (field: string, value: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={Clock} className="mr-1.5 h-3.5 w-3.5"/>
                    Atraso (Delay)
                </div>
            </CardHeader>
            <CardContent className={cn(NODE_CONTENT_CLASSES, "flex items-center space-x-1.5")}> {/* Usando cn para combinar classes */}
                <NodeInput
                    type="number"
                    value={duration}
                    onChange={(e) => {const val = parseInt(e.target.value) || 1; setDuration(val); updateNodeData('duration', val)}}
                    className="w-16"
                    min={1}
                />
                <NodeSelect value={unit} onValueChange={(val: 'seconds' | 'minutes') => {setUnit(val); updateNodeData('unit', val)}}>
                    <SelectItem value="seconds" className='text-xs'>Segundos</SelectItem>
                    <SelectItem value="minutes" className='text-xs'>Minutos</SelectItem>
                </NodeSelect>
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
