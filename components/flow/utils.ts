// components/flow/utils.ts
import React from 'react';
import { cn } from "@/lib/utils";
import { LucideProps } from 'lucide-react';

// Cores Neon - EXPORTADAS
export const NEON_COLOR = '#1E90FF'; // Azul Padrão
export const NEON_GREEN = '#39FF14'; // Verde para Sucesso
export const NEON_RED = '#FF3131';   // Vermelho para Erro/Perigo
export const NEON_ORANGE = '#FFA500'; // Laranja para Fallback/Timeout/Aviso
export const NEON_PURPLE = '#8A2BE2'; // Roxo para IA
export const NEON_TEAL = '#00CED1';   // Verde-Azulado para Botões
export const NEON_SKY = '#00BFFF';    // Azul Céu para Lista

export const NEON_COLOR_RGB = "30, 144, 255"; // RGB do NEON_COLOR para uso em estilos rgba

// Componente auxiliar para ícones com brilho neon - EXPORTADO
export const IconWithGlow: React.FC<{
    icon: React.ComponentType<LucideProps>;
    className?: string;
    color?: string; // Permite sobrescrever a cor do brilho
}> = ({ icon: IconComponent, className, color }) => {
    const glowColor = color || NEON_COLOR; // Usa a cor passada ou o azul padrão
    return React.createElement(IconComponent, {
        className: cn("node-icon", className),
        style: { filter: `drop-shadow(0 0 4px ${glowColor}cc) drop-shadow(0 0 8px ${glowColor}77)` }
    });
};

// Estilos base para componentes UI no editor - EXPORTADOS
export const baseButtonSelectStyle = `
    bg-[#18181b] border border-transparent text-gray-200
    shadow-[2px_2px_5px_rgba(0,0,0,0.5),-2px_-2px_5px_rgba(255,255,255,0.07)]
    hover:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.07)]
    hover:bg-[rgba(${NEON_COLOR_RGB},0.15)] hover:border-[rgba(${NEON_COLOR_RGB},0.3)]
    focus:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.07)]
    focus:bg-[rgba(${NEON_COLOR_RGB},0.2)] focus:border-[rgba(${NEON_COLOR_RGB},0.4)]
    focus:ring-1 focus:ring-[rgba(${NEON_COLOR_RGB},0.5)] focus:ring-offset-0
    transition-all duration-150 ease-in-out
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#18181b] disabled:hover:shadow-[2px_2px_5px_rgba(0,0,0,0.5),-2px_-2px_5px_rgba(255,255,255,0.07)]
`;

export const baseCardStyle = `
    bg-[#18181b] border border-transparent
    shadow-[4px_4px_8px_rgba(0,0,0,0.5),-4px_-4px_8px_rgba(255,255,255,0.07)]
    rounded-lg
`;

export const baseInputInsetStyle = `
    bg-[#121214] border border-transparent text-gray-100 placeholder:text-gray-500
    shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6),inset_-2px_-2px_4px_rgba(255,255,255,0.06)]
    focus:shadow-[2px_2px_5px_rgba(0,0,0,0.5),-2px_-2px_5px_rgba(255,255,255,0.07)]
    focus:ring-1 focus:ring-[rgba(${NEON_COLOR_RGB},0.6)] focus:ring-offset-0
    focus:bg-[#161618] focus:border-[rgba(${NEON_COLOR_RGB},0.3)]
    transition-all duration-150 ease-in-out
    disabled:opacity-60 disabled:cursor-not-allowed
`;

export const popoverContentStyle = `
    bg-[#20242A] border border-[rgba(${NEON_COLOR_RGB},0.3)] text-gray-200
    shadow-xl rounded-md
`;

export const customScrollbarStyle = `
    [&::-webkit-scrollbar]:w-1.5
    [&::-webkit-scrollbar]:h-1.5
    [&::-webkit-scrollbar-track]:bg-transparent
    [&::-webkit-scrollbar-thumb]:bg-[rgba(${NEON_COLOR_RGB},0.4)]
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb:hover]:bg-[rgba(${NEON_COLOR_RGB},0.6)]
    dark:[&::-webkit-scrollbar-track]:bg-transparent
    dark:[&::-webkit-scrollbar-thumb]:bg-[rgba(${NEON_COLOR_RGB},0.5)]
    dark:[&::-webkit-scrollbar-thumb:hover]:bg-[rgba(${NEON_COLOR_RGB},0.7)]
`;

// CORREÇÃO: Removida a lista de exportação explícita redundante no final.
// Todas as exportações já são feitas com 'export const' ou 'export' acima.
