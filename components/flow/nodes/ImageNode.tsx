import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ImageIcon } from 'lucide-react';
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

export function ImageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [url, setUrl] = useState(data?.url || '');
    const [caption, setCaption] = useState(data?.caption || '');

    const updateNodeData = (field: string, value: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={ImageIcon} className="mr-1.5 h-3.5 w-3.5"/>
                    Imagem
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>URL da Imagem</NodeLabel>
                <NodeInput
                    value={url}
                    onChange={(e) => {setUrl(e.target.value); updateNodeData('url', e.target.value)}}
                    placeholder="https://exemplo.com/imagem.png"
                />
                <NodeLabel className="mt-1">Legenda (Opcional)</NodeLabel>
                <NodeTextarea
                    value={caption}
                    onChange={(e) => {setCaption(e.target.value); updateNodeData('caption', e.target.value)}}
                    placeholder="Legenda da imagem..."
                />
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
