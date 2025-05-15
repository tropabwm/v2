// components/ChatMessage.tsx
import React from 'react';
import { Message as ChatMessageType } from '@/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Adicionado AvatarImage
import { User, Settings2 } from 'lucide-react'; // Mantido Settings2 para 'tool', Bot removido
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image'; // <<< Importar Image do Next.js

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant'; // Adicionado para clareza

  const getRoleDisplayName = () => {
    if (isAssistant) return 'Ubie';
    if (isUser) return 'Você';
    if (isTool) return `Resultado: ${message.name || 'Ferramenta'}`;
    if (isSystem) return 'Sistema';
    return message.role.charAt(0).toUpperCase() + message.role.slice(1);
  };

  const isAssistantToolCallJsonContent =
    isAssistant &&
    typeof message.content === 'string' &&
    message.content.startsWith('[{"id":') &&
    message.content.endsWith('}]') &&
    (message.content.includes('"type":"function"') || message.content.includes('"function":'));

  if (isSystem && !message.content) return null;

  return (
    <div className={cn(
        "flex items-start gap-3 w-full my-2.5",
        isUser ? "justify-end" : "justify-start",
        isSystem ? "justify-center" : ""
    )}>
      {/* Avatar para assistente, ferramenta e sistema */}
      {!isUser && (
        <Avatar className="h-8 w-8 border border-border flex-shrink-0 bg-background"> {/* Adicionado bg para fallback */}
          {/* *** ALTERAÇÃO AQUI: Usar Imagem para Ubie *** */}
          {isAssistant ? (
            <>
              <AvatarImage src="/character.png" alt="Ubie Avatar" className="object-cover" />
              {/* Fallback caso a imagem não carregue */}
              <AvatarFallback className={cn('flex items-center justify-center text-sm bg-secondary text-secondary-foreground')}>
                 U
              </AvatarFallback>
            </>
          ) : (
            // Fallback para Tool ou System
            <AvatarFallback className={cn(
              'flex items-center justify-center text-sm',
              isTool ? 'bg-purple-600 text-purple-100' : 'bg-gray-500 text-gray-100'
            )}>
              {isTool ? <Settings2 size={14} /> : 'S'}
            </AvatarFallback>
          )}
        </Avatar>
      )}

      {/* Bloco da Mensagem (Conteúdo) */}
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)]",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : isTool
              ? "bg-purple-700 text-gray-100 rounded-bl-none text-xs"
              : isSystem
                ? "bg-slate-600 text-gray-200 rounded-md text-xs italic text-center max-w-full"
                : "bg-secondary text-secondary-foreground rounded-bl-none" // Estilo padrão para assistente
        )}
        style={{ overflowWrap: 'break-word', wordWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto' }}
      >
        {/* Cabeçalho opcional (nome do remetente) */}
        {(!isUser) && ( // Mostrar para assistente, tool, system
          <div className="font-semibold text-xs mb-1 opacity-80">{getRoleDisplayName()}</div>
        )}

        {/* Renderização do Conteúdo */}
        {isAssistantToolCallJsonContent ? (
            <span className="text-xs italic text-muted-foreground">
                Ubie está processando com uma ferramenta...
            </span>
        ) : message.content ? (
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser ? "prose-invert" : "prose-invert", // Assumindo fundos escuros para ambos
            "prose-p:my-1 prose-ul:my-1 prose-ol:my-1",
            "prose-a:text-teal-400 hover:prose-a:text-teal-300 prose-a:underline",
            "prose-code:text-pink-400 prose-code:before:content-none prose-code:after:content-none prose-code:p-0.5 prose-code:bg-slate-800 prose-code:rounded-sm",
            "prose-pre:bg-slate-800 prose-pre:p-2 prose-pre:rounded-md"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          message.role === 'assistant' && !message.isThinking && !message.error && (
            <span className="text-xs italic text-muted-foreground">(Resposta em processamento ou sem texto)</span>
          )
        )}

        {/* Indicador de "Pensando..." */}
        {message.isThinking && (
            <div className="flex items-center mt-1 text-muted-foreground">
                <span className="text-xs mr-1">Pensando...</span>
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
            </div>
        )}
        {/* Exibição de Erro */}
         {message.error && (
            <div className="mt-1 text-xs text-red-300 bg-red-800/30 p-1 rounded">
                Erro: {message.error}
            </div>
        )}
      </div>

      {/* Avatar do Usuário */}
       {isUser && (
        <Avatar className="h-8 w-8 border border-border flex-shrink-0">
          <AvatarFallback className='bg-primary text-primary-foreground flex items-center justify-center'>
              <User size={16}/>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
