import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapPin } from 'lucide-react';
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

export function LocationMessageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [latitude, setLatitude] = useState(data?.latitude || '');
    const [longitude, setLongitude] = useState(data?.longitude || '');
    // Campos 'name' e 'address' estavam no segundo código, mas não no primeiro.
    // Se eles forem necessários, adicione os estados e inputs correspondentes.
    // Por enquanto, sigo o segundo código que só tem latitude e longitude.

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
                    <IconWithGlow icon={MapPin} className="mr-1.5 h-3.5 w-3.5"/>
                    Localização
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Latitude</NodeLabel>
                <NodeInput
                    value={latitude}
                    onChange={e => {setLatitude(e.target.value); update('latitude', e.target.value)}}
                    placeholder="-23.55052"
                />
                <NodeLabel className="mt-1">Longitude</NodeLabel>
                <NodeInput
                    value={longitude}
                    onChange={e => {setLongitude(e.target.value); update('longitude', e.target.value)}}
                    placeholder="-46.633308"
                />
            </CardContent>
            <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/>
        </Card>
    );
}
