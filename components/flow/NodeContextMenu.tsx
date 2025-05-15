// components/flow/NodeContextMenu.tsx
// C:\Users\ADM\Desktop\v13-main\components\flow\NodeContextMenu.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 as IconTrash, Copy as IconCopy, Pencil } from 'lucide-react';
import { NodeContextMenuProps } from '@/types/zap';
import { baseButtonSelectStyle, NEON_COLOR, popoverContentStyle } from './utils';

interface Props extends NodeContextMenuProps {
    onClose: () => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    // Adicione mais handlers conforme necessário, ex: onEdit
}

const NodeContextMenu: React.FC<Props> = ({ id, top, left, nodeType, onClose, onDelete, onDuplicate }) => {
    const style = { top: `${top}px`, left: `${left}px`, zIndex: 1500 }; // zIndex aumentado

    const handleMenuItemClick = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <div
            style={style}
            className={cn(popoverContentStyle, "absolute w-44 rounded-md p-1 shadow-xl")}
            // onMouseLeave={onClose} // Descomente se quiser que feche ao sair, mas pode ser irritante
        >
            <button
                onClick={() => handleMenuItemClick(() => onDuplicate(id))}
                className={cn(baseButtonSelectStyle, "w-full text-left px-2 py-1.5 text-xs rounded hover:!bg-[rgba(30,144,255,0.3)] focus:!bg-[rgba(30,144,255,0.3)] flex items-center")}
            >
                <IconCopy className="h-3.5 w-3.5 mr-2" style={{ filter: `drop-shadow(0 0 2px ${NEON_COLOR}99)` }} /> Duplicar Nó
            </button>
            <button
                onClick={() => handleMenuItemClick(() => onDelete(id))}
                className={cn(baseButtonSelectStyle, "w-full text-left px-2 py-1.5 text-xs rounded mt-1 !text-red-400 hover:!bg-red-500/30 focus:!bg-red-500/30 flex items-center")}
            >
                <IconTrash className="h-3.5 w-3.5 mr-2" style={{ filter: `drop-shadow(0 0 2px #ef444499)` }} /> Deletar Nó
            </button>
            {/* Exemplo de item de menu adicional (descomente e adapte se necessário) */}
            {/* {nodeType === 'textMessage' && (
                 <button
                    onClick={() => handleMenuItemClick(() => {
                        // Implementar lógica de edição, talvez abrindo um modal
                        console.log(`Editar nó ${id} do tipo ${nodeType}`);
                    })}
                    className={cn(baseButtonSelectStyle, "w-full text-left px-2 py-1.5 text-xs rounded mt-1 hover:!bg-[rgba(30,144,255,0.3)] focus:!bg-[rgba(30,144,255,0.3)] flex items-center")}
                 >
                    <Pencil className="h-3.5 w-3.5 mr-2" style={{ filter: `drop-shadow(0 0 2px ${NEON_COLOR}99)` }} /> Editar Conteúdo
                 </button>
            )} */}
        </div>
    );
};

export default NodeContextMenu;
