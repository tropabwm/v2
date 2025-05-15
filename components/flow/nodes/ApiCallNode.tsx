import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioTower } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow e baseCardStyle de utils
import { IconWithGlow, baseCardStyle } from '@/components/flow/utils';
// Importe as constantes de estilo base e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NodeSelect,
    NodeTextarea,
    NODE_CARD_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HEADER_CLASSES,     // <-- Importe daqui agora
    NODE_CONTENT_CLASSES,    // <-- Importe daqui agora
    NODE_HANDLE_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HANDLE_GLOW_CLASSES  // <-- Importe daqui agora
} from '../ui/FlowUIComponents';
import { SelectItem } from '@/components/ui/select';

export function ApiCallNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [apiUrl, setApiUrl] = useState(data?.apiUrl || '');
    const [method, setMethod] = useState(data?.method || 'GET');
    const [headers, setHeaders] = useState(data?.headers || '');
    const [body, setBody] = useState(data?.body || '');
    const [saveResponseTo, setSaveResponseTo] = useState(data?.saveResponseTo || '');
    // O campo 'timeoutMs' estava no segundo código, mas não no primeiro.
    // Se ele for necessário, adicione o estado e o input correspondente.
    // Por enquanto, sigo o segundo código que não o inclui.

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-64")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={RadioTower} className="mr-1.5 h-3.5 w-3.5"/>
                    Chamada API Externa
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>URL (Use {'{{var}}'})</NodeLabel>
                <NodeInput
                    value={apiUrl}
                    onChange={e => {setApiUrl(e.target.value); update('apiUrl', e.target.value)}}
                    placeholder="https://api.exemplo.com/dados"
                />
                <NodeLabel className="mt-1">Método</NodeLabel>
                <NodeSelect value={method} onValueChange={val => {setMethod(val); update('method', val)}}>
                    <SelectItem value="GET" className='text-xs'>GET</SelectItem>
                    <SelectItem value="POST" className='text-xs'>POST</SelectItem>
                    <SelectItem value="PUT" className='text-xs'>PUT</SelectItem>
                    <SelectItem value="DELETE" className='text-xs'>DELETE</SelectItem>
                    <SelectItem value="PATCH" className='text-xs'>PATCH</SelectItem>
                </NodeSelect>
                <NodeLabel className="mt-1">Headers (JSON, Opcional, Use {'{{var}}'})</NodeLabel>
                <NodeTextarea
                    value={headers}
                    onChange={e => {setHeaders(e.target.value); update('headers', e.target.value)}}
                    placeholder={'{"Content-Type": "application/json",\n "Authorization": "Bearer {{token}}"}'}
                />
                <NodeLabel className="mt-1">Corpo (JSON/Texto, Opcional, Use {'{{var}}'})</NodeLabel>
                <NodeTextarea
                    value={body}
                    onChange={e => {setBody(e.target.value); update('body', e.target.value)}}
                    placeholder={'{"chave": "{{valor_variavel}}"}'}
                />
                <NodeLabel className="mt-1">Salvar Resposta em Variável (Opcional)</NodeLabel>
                <NodeInput
                    value={saveResponseTo}
                    onChange={e => {setSaveResponseTo(e.target.value); update('saveResponseTo', e.target.value)}}
                    placeholder="nome_variavel_resposta"
                />
            </CardContent>
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-success"
                title="Sucesso"
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-error"
                style={{ top: '50%', right: '-12px' }}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')}
                title="Erro na Chamada"
            />
        </Card>
    );
}
