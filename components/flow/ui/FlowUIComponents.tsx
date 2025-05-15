import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
// Importe APENAS as constantes de estilo e cores de utils que são usadas NESTE arquivo
import {
    NEON_COLOR,
    baseInputInsetStyle as baseInputInsetStyleFromUtils, // Renomeado para uso interno
    baseButtonSelectStyle as baseButtonSelectStyleFromUtils, // Renomeado
    popoverContentStyle as popoverContentStyleFromUtils, // Renomeado
    customScrollbarStyle as customScrollbarStyleFromUtils // Renomeado
} from '@/components/flow/utils';

// Componentes de UI auxiliares para os nós - EXPORTADOS INDIVIDUALMENTE
export const NodeInput = (props: React.ComponentProps<typeof Input>) => (
    <Input {...props} className={cn(baseInputInsetStyleFromUtils, "text-[11px] h-7 px-1.5 py-1 rounded", props.className)} />
);

export const NodeLabel = (props: React.ComponentProps<typeof Label>) => (
    <Label {...props} className={cn("text-[10px] text-gray-400 mb-0.5 block font-normal", props.className)} style={{ textShadow: `0 0 3px ${NEON_COLOR}30` }}/>
);

export const NodeButton = (props: React.ComponentProps<typeof Button>) => (
    <Button variant="outline" {...props} className={cn(baseButtonSelectStyleFromUtils, `text-[10px] h-6 w-full rounded-sm px-2`, props.className)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }} />
);

export const NodeSelect = ({ children, placeholder, ...props }: React.ComponentProps<typeof Select> & { placeholder?: string }) => (
    <Select {...props}>
        <SelectTrigger className={cn(baseButtonSelectStyleFromUtils, "h-7 text-[11px] rounded px-1.5")}>
            <SelectValue placeholder={placeholder || 'Selecione...'} />
        </SelectTrigger>
        <SelectContent className={cn(popoverContentStyleFromUtils, "text-xs")}>
            {children}
        </SelectContent>
    </Select>
);

export const NodeTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const currentRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>;

    const autoResize = useCallback(() => {
        if (currentRef.current) {
            currentRef.current.style.height = 'auto';
            currentRef.current.style.height = `${currentRef.current.scrollHeight}px`;
        }
    }, [currentRef]);

    useEffect(() => {
        autoResize();
    }, [value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        autoResize();
        if (props.onChange) props.onChange(e);
    };

    return (
        <Textarea
            ref={currentRef}
            className={cn(baseInputInsetStyleFromUtils, "text-[11px] resize-none overflow-hidden min-h-[32px] p-1.5 rounded", className)}
            rows={1}
            value={value}
            {...props}
            onChange={handleChange}
            onFocus={autoResize}
        />
    );
});
NodeTextarea.displayName = "NodeTextarea";

// Constantes de estilo base para os nós (movidas para cá para consolidação) - EXPORTADAS INDIVIDUALMENTE
export const NODE_CARD_BASE_CLASSES = "node-card w-60 shadow-lg";
export const NODE_HEADER_CLASSES = "node-header !p-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing";
export const NODE_CONTENT_CLASSES = "p-2 space-y-1.5";
export const NODE_HANDLE_BASE_CLASSES = "!bg-gray-700 !border-none !h-2.5 !w-2.5";
export const NODE_HANDLE_GLOW_CLASSES = "node-handle-glow";

// customScrollbarStyle VEM de utils, não deveria ser definido/exportado daqui.
// CORREÇÃO: Não exportamos customScrollbarStyle deste arquivo. Ele deve ser importado diretamente de utils.ts onde for usado.
// Se algum componente de nó ou o flow.tsx precisa dele, importe de '@/components/flow/utils'.

// CORREÇÃO: Removida a lista de exportação explícita redundante no final.
// As exportações já são feitas com 'export const' acima.
