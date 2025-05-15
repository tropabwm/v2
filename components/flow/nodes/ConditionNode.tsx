import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Waypoints } from 'lucide-react';
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
    NODE_HANDLE_BASE_CLASSES, // <-- Importe daqui agora
    NODE_HANDLE_GLOW_CLASSES  // <-- Importe daqui agora
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents
import { SelectItem } from '@/components/ui/select'; // Importe SelectItem

export function ConditionNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [variableName, setVariableName] = useState(data?.variableName || '');
    const [comparison, setComparison] = useState(data?.comparison || 'equals');
    const [value, setValue] = useState(data?.value || '');

    const update = (field: string, val: any) => {
        setNodes(nds =>
            nds.map(n =>
                n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n
            )
        );
    };

    const showValueInput = !['isSet', 'isNotSet'].includes(comparison);

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={Waypoints} className="mr-1.5 h-3.5 w-3.5"/>
                    Condição (Se/Então)
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Variável (Ex: {'{{userInput}}'})</NodeLabel>
                <NodeInput
                    value={variableName}
                    onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}}
                    placeholder="nome_variavel"
                />
                <NodeLabel className="mt-1">Comparação</NodeLabel>
                <NodeSelect
                    value={comparison}
                    onValueChange={val => {
                        setComparison(val);
                        update('comparison', val);
                        // Limpa o valor se a comparação não precisar dele
                        if (['isSet', 'isNotSet'].includes(val)) {
                            setValue('');
                            update('value', '');
                        }
                    }}
                >
                    <SelectItem value="equals" className='text-xs'>Igual a</SelectItem>
                    <SelectItem value="contains" className='text-xs'>Contém</SelectItem>
                    <SelectItem value="startsWith" className='text-xs'>Começa com</SelectItem>
                    <SelectItem value="isSet" className='text-xs'>Está Definida</SelectItem>
                    <SelectItem value="isNotSet" className='text-xs'>Não Está Definida</SelectItem>
                    <SelectItem value="greaterThan" className='text-xs'>Maior que (Numérico)</SelectItem>
                    <SelectItem value="lessThan" className='text-xs'>Menor que (Numérico)</SelectItem>
                    <SelectItem value="regex" className='text-xs'>Corresponde ao Regex</SelectItem>
                </NodeSelect>
                {showValueInput && (
                    <>
                        <NodeLabel className="mt-1">Valor (Use {'{{var}}'} ou Regex)</NodeLabel>
                        <NodeInput
                            value={value}
                            onChange={e => {setValue(e.target.value); update('value', e.target.value)}}
                            placeholder="Valor ou /pattern/flags"
                        />
                    </>
                )}
            </CardContent>
            <Handle
                type="source"
                position={Position.Right}
                id="source-true"
                style={{top: '35%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}
                title="Verdadeiro"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-false"
                style={{top: '65%', right: '-12px'}}
                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')}
                title="Falso"
            />
        </Card>
    );
}
