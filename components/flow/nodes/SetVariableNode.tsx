import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Variable } from 'lucide-react';
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
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui neste nó
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents

export function SetVariableNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [variableName, setVariableName] = useState(data?.variableName || 'minhaVariavel');
    const [value, setValue] = useState(data?.value || '');

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
                    <IconWithGlow icon={Variable} className="mr-1.5 h-3.5 w-3.5"/>
                    Definir Variável
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Nome da Variável</NodeLabel>
                <NodeInput
                    value={variableName}
                    onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}}
                    placeholder="nome_variavel"
                />
                <NodeLabel className="mt-1">Valor (Use {'{{outra_var}}'} para interpolar)</NodeLabel>
                <NodeInput
                    value={value}
                    onChange={e => {setValue(e.target.value); update('value', e.target.value)}}
                    placeholder="Texto, número ou {{variavel}}"
                />
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
