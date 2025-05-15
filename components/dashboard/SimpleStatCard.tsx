// components/dashboard/SimpleStatCard.tsx
import React from 'react';
import { LucideIcon, Loader2, Circle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleStatCardProps {
    label: string;
    value: string;
    icon?: LucideIcon;
    percentageChange?: number | null;
    isLoading?: boolean;
    // Adicionada prop para cor neon, default para o azul padrão
    neonColor?: string; 
}

const SimpleStatCard: React.FC<SimpleStatCardProps> = ({
    label,
    value,
    icon: Icon,
    percentageChange,
    isLoading,
    neonColor = '#1E90FF', // Cor neon azul padrão
}) => {
    const changeValid = typeof percentageChange === 'number' && !isNaN(percentageChange) && isFinite(percentageChange);
    // Usando cores Tailwind para consistência, mas pode ser ajustado
    const changeColorClass = !changeValid ? 'text-gray-500' : percentageChange >= 0 ? 'text-emerald-500' : 'text-red-500';
    const ChangeIcon = !changeValid ? Circle : percentageChange >= 0 ? ArrowUpCircle : ArrowDownCircle;
    const formattedChange = !changeValid ? 'N/A' : `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}%`;

    // Estilo base similar aos cards de filtro (neumórfico sutil)
    const cardBaseStyle = 
        "bg-[#141414]/80 backdrop-blur-sm " + // Fundo e blur
        "shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] " + // Sombra externa
        "rounded-lg border border-[hsl(var(--border))]/20 " + // Borda sutil
        "transition-all duration-300 ease-out group"; // Transições

    // Tamanho ajustado - você pode experimentar com estes valores
    // Ex: w-full para ocupar o espaço da grid, ou um w-[160px] h-[120px] fixo
    const cardSizeStyle = "w-full min-h-[100px] md:min-h-[110px]"; // Altura mínima, largura total na coluna da grid

    return (
        <div className={cn(cardBaseStyle, cardSizeStyle, "p-3 flex flex-col justify-between text-white")}> {/* Padding ajustado */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-4">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: neonColor }} />
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-start">
                        <h3 
                            className="text-[0.65rem] font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-200 transition-colors"
                            style={{ textShadow: `0 0 3px ${neonColor}60`}} // Leve sombra neon no label
                        >
                            {label}
                        </h3>
                        {Icon && <Icon className="h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors" />}
                    </div>
                    
                    <div className="my-1 text-center"> {/* Espaçamento ajustado */}
                        <p 
                            className="text-2xl md:text-3xl font-bold" // Tamanho da fonte ajustado
                            style={{ 
                                color: neonColor, // Cor principal do valor
                                textShadow: `0 0 5px ${neonColor}, 0 0 10px ${neonColor}AA, 0 0 15px ${neonColor}80` // Efeito neon
                            }}
                        >
                            {value}
                        </p>
                    </div>

                    <div className={cn(
                        "text-[0.6rem] flex items-center self-end font-medium", // Tamanho da fonte da % de mudança
                        changeColorClass,
                        "group-hover:opacity-90 transition-opacity"
                        )}
                    >
                        {changeValid && <ChangeIcon className="mr-1 w-2.5 h-2.5" />} {/* Ícone de mudança menor */}
                        {formattedChange}
                    </div>
                </>
            )}
        </div>
    );
};

export default SimpleStatCard;
