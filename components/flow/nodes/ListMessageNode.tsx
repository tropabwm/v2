import React, { useState } from 'react';
import { NodeProps, Handle, Position, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, Plus, X } from 'lucide-react';
import { cn } from "@/lib/utils";
// Add baseInputInsetStyle to the imports from utils
import {
    IconWithGlow,
    baseCardStyle,
    baseButtonSelectStyle,
    baseInputInsetStyle, // Added missing import
    NEON_ORANGE,
    customScrollbarStyle
} from '@/components/flow/utils';
import {
    NodeInput,
    NodeLabel,
    NodeButton,
    NodeTextarea,
    NodeSelect,
    NODE_CARD_BASE_CLASSES,
    NODE_HEADER_CLASSES,
    NODE_CONTENT_CLASSES,
    NODE_HANDLE_BASE_CLASSES,
    NODE_HANDLE_GLOW_CLASSES
} from '../ui/FlowUIComponents';
import { ListSection, ListItem } from '@/types/zap';

export function ListMessageNode({ id, data }: NodeProps<any>) {
    const { setNodes } = useReactFlow();
    const [text, setText] = useState(data?.text || '');
    const [title, setTitle] = useState(data?.title || 'Título da Lista');
    const [buttonText, setButtonText] = useState(data?.buttonText || 'Ver Opções');
    const [footer, setFooter] = useState(data?.footer || '');
    const [sections, setSections] = useState<ListSection[]>(data?.sections || [{ id: `sec_${id.slice(-4)}_0`, title: 'Seção 1', rows: [{ id: `row_${id.slice(-4)}_0_0`, title: 'Item 1', description: '' }] }]);

    const updateNodeData = (field: string, value: any) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));
    };

    const handleSectionTitleChange = (sectionId: string, newTitle: string) => {
        const newSections = sections.map(s => s.id === sectionId ? { ...s, title: newTitle } : s);
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    const handleRowChange = (sectionId: string, rowId: string, field: 'title' | 'description', newValue: string) => {
        const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: s.rows.map(r => r.id === rowId ? { ...r, [field]: newValue } : r) } : s);
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    const addSection = () => {
        if (sections.length >= 5) return;
        const newSectionId = `sec_${id.slice(-4)}_${sections.length}_${Date.now()%10000}`;
        const newSections = [...sections, { id: newSectionId, title: `Nova Seção ${sections.length + 1}`, rows: [{id: `row_${newSectionId}_0`, title: "Novo Item 1", description: ""}] }];
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    const removeSection = (sectionId: string) => {
        const newSections = sections.filter(s => s.id !== sectionId);
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    const addRowToSection = (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        if (section && section.rows.length >= 10) return;
        const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: [...s.rows, {id: `row_${sectionId}_${s.rows.length}_${Date.now()%10000}`, title: `Novo Item ${s.rows.length+1}`, description: ""}] } : s);
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    const removeRowFromSection = (sectionId: string, rowId: string) => {
        const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: s.rows.filter(r => r.id !== rowId) } : s);
        setSections(newSections);
        updateNodeData('sections', newSections);
    };

    return (
        <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-72")}>
            <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/>
            <CardHeader className={NODE_HEADER_CLASSES}>
                <div className="flex items-center text-xs">
                    <IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5 text-sky-400"/>
                    Mensagem de Lista
                </div>
            </CardHeader>
            <CardContent className={NODE_CONTENT_CLASSES}>
                <NodeLabel>Texto do Corpo (Opcional)</NodeLabel>
                <NodeTextarea
                    value={text}
                    onChange={e => {setText(e.target.value); updateNodeData('text', e.target.value)}}
                    placeholder="Instrução ou descrição..."
                />
                <NodeLabel className="mt-1">Título da Lista (Obrigatório)</NodeLabel>
                <NodeInput
                    value={title}
                    onChange={e => {setTitle(e.target.value); updateNodeData('title', e.target.value)}}
                    placeholder="Ex: Nossos Serviços"
                />
                <NodeLabel className="mt-1">Texto do Botão da Lista (Obrigatório)</NodeLabel>
                <NodeInput
                    value={buttonText}
                    onChange={e => {setButtonText(e.target.value); updateNodeData('buttonText', e.target.value)}}
                    placeholder="Ex: Escolha uma opção"
                />
                <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel>
                <NodeInput
                    value={footer}
                    onChange={e => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}}
                    placeholder="Texto rodapé..."
                />

                <div className={cn("mt-2 space-y-2 max-h-48 overflow-y-auto pr-1", customScrollbarStyle)}>
                    {sections.map((section, sIdx) => (
                        <div key={section.id} className={cn(baseInputInsetStyle, "p-1.5 rounded-sm space-y-1")}>
                            <div className="flex items-center justify-between">
                                <NodeInput
                                    value={section.title}
                                    onChange={e => handleSectionTitleChange(section.id, e.target.value)}
                                    placeholder={`Título Seção ${sIdx+1}`}
                                    className="text-xs flex-grow !h-6"
                                />
                                <Button
                                    onClick={() => removeSection(section.id)}
                                    variant="ghost"
                                    size="icon"
                                    className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}
                                >
                                    <X className='w-3 h-3'/>
                                </Button>
                            </div>
                            {section.rows.map((row, rIdx) => (
                                <div key={row.id} className="ml-2 space-y-0.5 relative">
                                    <div className="flex items-center gap-1">
                                        <NodeInput
                                            value={row.title}
                                            onChange={e => handleRowChange(section.id, row.id, 'title', e.target.value)}
                                            placeholder={`Item ${rIdx+1}`}
                                            className="text-[10px] flex-grow !h-5"
                                        />
                                        <Button
                                            onClick={() => removeRowFromSection(section.id, row.id)}
                                            variant="ghost"
                                            size="icon"
                                            className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-4 h-4 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}
                                        >
                                            <X className='w-2.5 h-2.5'/>
                                        </Button>
                                    </div>
                                    <NodeInput
                                        value={row.description || ''}
                                        onChange={e => handleRowChange(section.id, row.id, 'description', e.target.value)}
                                        placeholder="Descrição (opcional)"
                                        className="text-[10px] !h-5"
                                    />
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={row.id}
                                        style={{ top: `50%`, right: '-12px', transform: 'translateY(-50%)' }}
                                        className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-sky-500')}
                                        title={row.title || `Item ${rIdx + 1}`}
                                        isConnectable={true}
                                    />
                                </div>
                            ))}
                            <NodeButton onClick={() => addRowToSection(section.id)} disabled={section.rows.length >=10} className="text-[9px] !h-5 mt-1">
                                <Plus className="mr-0.5 h-2.5 w-2.5"/> Item
                            </NodeButton>
                        </div>
                    ))}
                </div>
                
                {/* Add a button to add new sections */}
                {sections.length < 5 && (
                    <NodeButton onClick={addSection} className="mt-2 text-xs !h-6">
                        <Plus className="mr-1 h-3 w-3"/> Nova Seção
                    </NodeButton>
                )}
                
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="source-fallback"
                    style={{left: '50%' }}
                    className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-orange-500')}
                    title="Fallback (Sem seleção/Erro)"
                    isConnectable={true}
                />
            </CardContent>
        </Card>
    );
}
