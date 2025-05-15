import React from 'react';
import { LucideIcon, Loader2, Circle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlassStatCardProps {
    label: string;
    value: string;
    icon?: LucideIcon;
    percentageChange?: number | null;
    isLoading?: boolean;
    details?: string;
}

// Defina o azul da sua sidebar aqui. Exemplo:
const SIDEBAR_BLUE_NEON = '#5271FF';
// Sombra para o card em si
const CARD_NEON_SHADOW_STYLE = {
    boxShadow: `0 0 10px ${SIDEBAR_BLUE_NEON}33, 0 0 18px ${SIDEBAR_BLUE_NEON}22, inset 0 0 5px ${SIDEBAR_BLUE_NEON}1A`
};
// Estilo para o TEXTO do valor principal ser BRANCO, mas com SOMBRA neon azul
const VALUE_TEXT_STYLE_WITH_NEON_SHADOW = {
    color: '#FFFFFF', // Texto branco
    textShadow: `0 0 6px ${SIDEBAR_BLUE_NEON}E0, 0 0 9px ${SIDEBAR_BLUE_NEON}B0, 0 0 12px ${SIDEBAR_BLUE_NEON}80`
};


const GlassStatCard: React.FC<GlassStatCardProps> = ({
    label,
    value,
    icon: Icon,
    percentageChange,
    isLoading,
    details,
}) => {
    const changeValid = typeof percentageChange === 'number' && !isNaN(percentageChange) && isFinite(percentageChange);
    const changeTextColorClass = !changeValid ? 'text-gray-500' : percentageChange >= 0 ? 'text-emerald-400' : 'text-red-400';
    const ChangeIcon = !changeValid ? Circle : percentageChange >= 0 ? ArrowUpCircle : ArrowDownCircle;
    const formattedChange = !changeValid ? '' : `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}%`;

    const cardBaseStyle = cn(
        "relative overflow-hidden rounded-xl p-4 flex flex-col justify-between min-h-[100px] md:min-h-[115px]", // Altura ajustada
        "bg-black/40 backdrop-blur-md", // Efeito glassmorphism
        "border border-blue-500/20",    // Borda azul bem sutil
        "shadow-lg hover:shadow-xl transition-all duration-300",
        "hover:border-blue-400/40"
    );

    return (
        <div className={cardBaseStyle} style={CARD_NEON_SHADOW_STYLE}>
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-xl">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: SIDEBAR_BLUE_NEON }} />
                </div>
            ) : null}

            <div className="flex justify-between items-start mb-1">
                <h3
                    className="text-[0.6rem] font-semibold text-gray-300 uppercase tracking-wider group-hover:text-gray-100 transition-colors"
                    style={{ textShadow: `0 0 2px ${SIDEBAR_BLUE_NEON}90`}} // Sombra neon sutil no label
                >
                    {label}
                </h3>
                {Icon && <Icon
                            className={cn("h-4 w-4 text-gray-400 group-hover:text-gray-200 transition-colors")}
                            style={{ filter: `drop-shadow(0 0 3px ${SIDEBAR_BLUE_NEON}99)`}} // Neon no ícone
                        />}
            </div>

            <div className="my-auto text-center py-1"> {/* Ajuste de padding vertical para o valor */}
                <p
                    className="text-2xl md:text-3xl font-bold" // Tamanho do valor
                    style={VALUE_TEXT_STYLE_WITH_NEON_SHADOW}
                >
                    {value}
                </p>
                {details && (
                    <p className="text-[0.55rem] text-gray-500 group-hover:text-gray-400 transition-colors text-center mt-0.5">{details}</p>
                )}
            </div>

            {(changeValid || (percentageChange !== undefined && percentageChange !== null)) && ( // Mostrar se for válido ou se for explicitamente para mostrar N/A
                 <div className={cn("text-[0.6rem] flex items-center self-start mt-1 font-medium", changeTextColorClass)}>
                    {changeValid && <ChangeIcon className="mr-1 w-2.5 h-2.5" />}
                    {!changeValid && <Circle className="mr-1 w-2.5 h-2.5 opacity-70" />}
                    {formattedChange || 'N/A'}
                </div>
            )}
        </div>
    );
};

export default GlassStatCard;
