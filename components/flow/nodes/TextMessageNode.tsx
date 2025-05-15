import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageSquare } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeTextarea,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES // <-- Importe daqui agora
    // NODE_HANDLE_GLOW_CLASSES não é usado aqui
} from '../ui/FlowUIComponents';

export function TextMessageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [text, setText] = useState(data?.text || '');

    const updateNodeData = (newText: string) => {
        setText(newText);
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, text: newText } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}>
            <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES} />
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={MessageSquare} className="mr-1.5 h-3.5 w-3.5"/>
                    Mensagem de Texto
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeTextarea
                    value={text}
                    onChange={(e) => updateNodeData(e.target.value)}
                    placeholder="Digite sua mensagem aqui..."
                />
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
