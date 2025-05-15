import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Importado Button
import { ListChecks, Plus, X } from 'lucide-react';
import { cn } from "@/lib/utils";
// Importe IconWithGlow, baseCardStyle, baseButtonSelectStyle E customScrollbarStyle de utils
import {
    IconWithGlow,
    baseCardStyle,
    baseButtonSelectStyle,
    customScrollbarStyle // <-- Importe customScrollbarStyle daqui agora
} from '@/components/flow/utils';
// Importe as constantes de estilo base dos nós e componentes de UI de FlowUIComponents
import {
    NodeInput,
    NodeLabel,
    NodeButton,
    NodeTextarea,
    NODE_CARD_BASE_CLASSES,
    NODE_HEADER_CLASSES,
    NODE_CONTENT_CLASSES,
    NODE_HANDLE_BASE_CLASSES,
    NODE_HANDLE_GLOW_CLASSES
} from '../ui/FlowUIComponents'; // <-- Importando de FlowUIComponents
import { ButtonOption } from '@/types/zap'; // Importe tipos específicos

export function ButtonMessageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [text, setText] = useState(data?.text || '');
    const [footer, setFooter] = useState(data?.footer || '');
    const [buttons, setButtons] = useState<ButtonOption[]>(data?.buttons || [{ id: `btn_${id.slice(-4)}_${Date.now()%10000}`, text: 'Opção 1' }]);

    const updateNodeData = (field: string, value: any) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));
    };

    const handleButtonTextChange = (buttonId: string, newText: string) => {
        const newButtons = buttons.map(b => b.id === buttonId ? { ...b, text: newText } : b);
        setButtons(newButtons);
        updateNodeData('buttons', newButtons);
    };

    const addButton = () => {
        if (buttons.length >= 3) return;
        const newButtonId = `btn_${id.slice(-4)}_${Date.now()%10000}_${buttons.length}`;
        const newButtons = [...buttons, { id: newButtonId, text: `Nova Opção ${buttons.length + 1}` }];
        setButtons(newButtons);
        updateNodeData('buttons', newButtons);
    };

    const removeButton = (buttonId: string) => {
        const newButtons = buttons.filter(b => b.id !== buttonId);
        setButtons(newButtons);
        updateNodeData('buttons', newButtons);
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}>
            <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5"/>
                    Mensagem com Botões
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Texto Principal</NodeLabel>
                <NodeTextarea
                    value={text}
                    onChange={(e) => {setText(e.target.value); updateNodeData('text', e.target.value)}}
                    placeholder="Mensagem principal..."
                />
                <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel>
                <NodeInput
                    value={footer}
                    onChange={(e) => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}}
                    placeholder="Texto do rodapé..."
                />
                <NodeLabel className="mt-1">Botões ({buttons.length}/3 max)</NodeLabel>
                <div className={cn('space-y-1 max-h-28 overflow-y-auto pr-1', customScrollbarStyle)}> {/* customScrollbarStyle usado aqui */}
                    {buttons.map((button, index) => (
                        <div key={button.id} className='relative group flex items-center gap-1'>
                            <NodeInput
                                value={button.text}
                                onChange={(e) => handleButtonTextChange(button.id, e.target.value)}
                                placeholder={`Texto Botão ${index+1}`}
                                className='flex-grow'
                            />
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={button.id}
                                style={{ top: `${20 + index * 28}px`, right: '-12px' }}
                                className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-teal-600')}
                                title={button.text || `Saída ${index+1}`}
                                isConnectable={true}
                            />
                            <Button
                                onClick={() => removeButton(button.id)}
                                variant="ghost"
                                size="icon"
                                className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}
                            >
                                <X className='w-3 h-3'/>
                            </Button>
                        </div>
                    ))}
                </div>
                {buttons.length < 3 && (
                    <NodeButton onClick={addButton} className="mt-1.5">
                        <Plus className="mr-1 h-3 w-3"/> Adicionar Botão
                    </NodeButton>
                )}
            </CardContent>
        </Card>
    );
}
