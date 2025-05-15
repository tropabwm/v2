// types/chat.ts

// Definição da estrutura de uma chamada de ferramenta (Tool Call)
// Esta interface estava faltando e causava o erro de compilação
export interface ToolCall {
  id: string;
  type: 'function'; // Geralmente é 'function' para APIs atuais
  function: {
    name: string;
    arguments: string; // Os argumentos são uma STRING JSON
  };
}

// Definição completa da mensagem para o Agente Ubie e outros chats
export interface Message {
  id?: string; // ID opcional (pode ser gerado no frontend ou vir do DB)
  role: 'user' | 'assistant' | 'system' | 'tool' | 'function'; // 'function' é sinônimo de 'tool' em algumas APIs
  content: string | null; // Conteúdo pode ser nulo, especialmente para assistant com tool_calls
  tool_calls?: ToolCall[] | null; // <<< ADICIONADO: Array de chamadas de ferramentas (opcional, para role: 'assistant')
  tool_call_id?: string | null; // ID da tool_call original (para role: 'tool')
  name?: string | null; // Nome da ferramenta que foi chamada (para role: 'tool' ou 'function')
  isThinking?: boolean; // Estado de UI (frontend)
  error?: string; // Estado de UI (frontend)
  timestamp?: number; // Estado de UI (frontend)
}

// Para o select de campanhas
export interface CampaignOption {
    id: number | string; // ID pode ser string ou number vindo da API
    name: string;
}

// Para o payload da ação de sugestão de cópia
export interface CopySuggestionPayload {
    suggestions: string; // O texto contendo uma ou mais sugestões
}

// Para salvar/carregar conversas do chat genérico (se ainda usar)
export interface Conversation { // Renomeado de UISavedConversation para evitar conflito
    id: string;
    title: string;
    date: string;
    messages: Message[];
    session_id?: string;
}

// Configurações do LLM da página Chat (se ainda usar)
export interface ModelConfig {
    providerType: 'local' | 'openai' | 'gemini' | 'custom';
    localServerUrl: string;
    apiKey: string;
    customApiUrl: string;
    temperature: number;
    maxTokens: number;
    repetitionPenalty: number;
    localModelName?: string;
}

// Metadados de conversas salvas do Ubie (DB)
export interface SavedConversationMetadata {
    id: number; // ID numérico do DB
    user_id: number;
    session_id: string; // UUID da sessão quando foi salva
    name: string; // Nome da conversa
    created_at: string; // Timestamp de criação
}

// Conversa salva completa do Ubie (DB), incluindo o histórico
export interface FullSavedConversation extends SavedConversationMetadata {
     history: Message[]; // Usa a interface Message completa
}
