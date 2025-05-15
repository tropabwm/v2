import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tag } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils
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
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui
} from '../ui/FlowUIComponents';
import { SelectItem } from '@/components/ui/select';

export function TagContactNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [tagName, setTagName] = useState(data?.tagName || '');
    const [action, setAction] = useState<'add' | 'remove'>(data?.action || 'add');

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
                    <IconWithGlow icon={Tag} className="mr-1.5 h-3.5 w-3.5"/>
                    Adicionar/Remover Tag
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Nome da Tag</NodeLabel>
                <NodeInput
                    value={tagName}
                    onChange={e => {setTagName(e.target.value); update('tagName', e.target.value)}}
                    placeholder="Ex: Lead Qualificado"
                />
                <NodeLabel className="mt-1">Ação</NodeLabel>
                <NodeSelect value={action} onValueChange={(val: 'add' | 'remove') => {setAction(val); update('action', val)}}>
                    <SelectItem value="add" className='text-xs'>Adicionar Tag</SelectItem>
                    <SelectItem value="remove" className='text-xs'>Remover Tag</SelectItem>
                </NodeSelect>
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
