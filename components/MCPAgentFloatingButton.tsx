// components/MCPAgentFloatingButton.tsx
"use client";
import React from 'react';
// Não importamos mais Button de '@/components/ui/button' para o wrapper externo
import Image from 'next/image';
import { useMCPAgentContext } from '@/context/MCPAgentContext';
import { NEON_COLOR } from '@/components/flow/utils';
import { cn } from '@/lib/utils';

const MCPAgentFloatingButton: React.FC = () => {
  const { toggleAgentPanel, isAgentPanelOpen } = useMCPAgentContext();

  if (isAgentPanelOpen) {
    return null;
  }

  // Estilo neon para a imagem
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${NEON_COLOR})` };

  return (
    // Substituímos o componente Button por um div.
    // Aplicamos todas as classes de posicionamento, tamanho, forma, sombra e foco diretamente aqui.
    <div
      onClick={toggleAgentPanel}
      // Adicionamos role="button" e aria-label para acessibilidade
      role="button"
      aria-label="Abrir USB IA Control"
      // Classes de posicionamento, tamanho, forma e z-index
      className={cn(
        "fixed bottom-6 right-6 rounded-full p-0 shadow-lg z-50", // Removido p-3, ajustado padding via div interna
        "w-12 h-12", // Tamanho fixo do container
        "flex items-center justify-center", // Centraliza o conteúdo interno (a imagem)
        // Adicionadas classes para garantir que o fundo é transparente e não tem bordas/outline padrão
        "bg-transparent border-none outline-none cursor-pointer", // Fundo transparente, sem borda/outline, cursor de clique
        // Classes para remover o contorno de foco azul (usando ring-0 e outline-none)
        "focus:outline-none focus:ring-0 focus:border-transparent" // Tailwind classes
        )}
      // Adicionar tabIndex para torná-lo focável via teclado
      tabIndex={0}
    >
      {/* Este div interno mantém a imagem com a forma circular e o filtro neon */}
      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center" style={iconNeonFilterStyle}>
          {/* Confirme que character.png está em /public */}
          <Image src="/character.png" alt="USB IA Control" fill style={{ objectFit: 'cover' }} sizes="32px" priority />
      </div>
    </div>
  );
};

export default MCPAgentFloatingButton;
