import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText as FileIcon } from 'lucide-react';
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

export function FileMessageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [url, setUrl] = useState(data?.url || '');
    const [filename, setFilename] = useState(data?.filename || '');
    // O campo 'mimetype' estava no segundo código, mas não no primeiro.
    // Se ele for necessário, adicione o estado e o input/select correspondente.
    // Por enquanto, sigo o segundo código que só tem URL e filename.

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
                    <IconWithGlow icon={FileIcon} className="mr-1.5 h-3.5 w-3.5"/>
                    Arquivo
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>URL do Arquivo</NodeLabel>
                <NodeInput
                    value={url}
                    onChange={e => {setUrl(e.target.value); update('url', e.target.value)}}
                    placeholder="https://exemplo.com/doc.pdf"
                />
                <NodeLabel className="mt-1">Nome do Arquivo (Opcional)</NodeLabel>
                <NodeInput
                    value={filename}
                    onChange={e => {setFilename(e.target.value); update('filename', e.target.value)}}
                    placeholder="documento.pdf"
                />
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
