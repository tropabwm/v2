// components/MCPAgent.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMCPAgentContext } from "@/context/MCPAgentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, PlusCircle, History, Save, Trash2, ArrowRight, Languages, Mic, MicOff } from "lucide-react";
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Image from 'next/image';
import { NEON_COLOR } from '@/components/flow/utils';
import { useToast } from "@/components/ui/use-toast";
import ChatMessage from './ChatMessage';
import { Message as ChatMessageType } from '@/types/chat'; // <<< Importar Message de @/types/chat

interface SavedConversationMetadata { // Esta interface pode ser movida para @/types/chat também se for usada em mais lugares
    id: number;
    user_id: number;
    session_id: string;
    name: string;
    created_at: string;
}

const MCPAgent = () => {
  const {
    isAgentPanelOpen,
    toggleAgentPanel,
    messages, // messages aqui é do tipo ChatMessageType[] (importado de @/types/chat via contexto)
    sendMessage,
    isLoading,
    startNewConversation,
    savedConversations, // Este é SavedConversationMetadata[]
    currentlyLoadedConversation,
    loadSavedConversations,
    saveConversation,
    loadConversation,
    resumeSavedConversation,
    deleteConversation,
    ubieLanguage,
    setUbieLanguage,
  } = useMCPAgentContext();

  const [inputMessage, setInputMessage] = useState("");
  const pathname = usePathname();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [saveInputName, setSaveInputName] = useState('');
  const [isSavingPromptOpen, setIsSavingPromptOpen] = useState(false);

  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 3px ${NEON_COLOR || '#00ffff'})` };

  const [isListening, setIsListening] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);


  useEffect(() => {
    if (isAgentPanelOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAgentPanelOpen]);

   useEffect(() => {
       if (isAgentPanelOpen) {
           loadSavedConversations();
       }
   }, [isAgentPanelOpen, loadSavedConversations]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        setSpeechApiSupported(true);
        const recognitionInstance = new SpeechRecognitionAPI() as SpeechRecognition;
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true; 
        recognitionInstance.lang = ubieLanguage;

        recognitionInstance.onstart = () => {
          console.log("Speech recognition started");
          setIsListening(true);
        };

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => { 
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setInputMessage(finalTranscript || interimTranscript);
        };

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error", event.error);
          let errorMsg = ubieLanguage === 'pt-BR' ? "Erro no reconhecimento de voz: " : "Speech recognition error: ";
          if (event.error === 'no-speech') {
            errorMsg += ubieLanguage === 'pt-BR' ? "Nenhuma fala detectada." : "No speech detected.";
          } else if (event.error === 'audio-capture') {
            errorMsg += ubieLanguage === 'pt-BR' ? "Problema na captura de áudio." : "Audio capture problem.";
          } else if (event.error === 'not-allowed' || event.error === 'aborted') { 
            errorMsg += ubieLanguage === 'pt-BR' ? "Permissão para microfone negada ou abortada." : "Microphone permission denied or aborted.";
            setMicPermissionGranted(false);
          } else {
            errorMsg += event.error;
          }
          toast({ title: ubieLanguage === 'pt-BR' ? "Erro de Voz" : "Voice Error", description: errorMsg, variant: "destructive" });
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          console.log("Speech recognition ended");
          setIsListening(false);
        };

        recognitionRef.current = recognitionInstance;
      } else {
        console.warn("Speech Recognition API not supported by this browser.");
        setSpeechApiSupported(false);
      }
    }
    if (recognitionRef.current) {
        recognitionRef.current.lang = ubieLanguage;
    }

  }, [ubieLanguage, toast]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      await sendMessage(inputMessage, pathname);
      setInputMessage("");
    }
  };

  const handleToggleListen = async () => {
    if (!speechApiSupported) {
      toast({ title: "Funcionalidade Indisponível", description: ubieLanguage === 'pt-BR' ? "Reconhecimento de voz não suportado neste navegador." : "Speech recognition not supported in this browser.", variant: "destructive" });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (micPermissionGranted === false) {
          toast({ title: ubieLanguage === 'pt-BR' ? "Permissão Negada" : "Permission Denied", description: ubieLanguage === 'pt-BR' ? "Você precisa permitir o acesso ao microfone nas configurações do seu navegador." : "You need to allow microphone access in your browser settings.", variant: "destructive" });
          return;
      }

      try {
        if (navigator.permissions && micPermissionGranted === null) {
             console.log("Verifying microphone permission via navigator.permissions...");
             const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
             console.log("Microphone permission status:", permissionStatus.state);
             if (permissionStatus.state === 'granted') {
                 setMicPermissionGranted(true);
             } else if (permissionStatus.state === 'denied') {
                 setMicPermissionGranted(false);
                 toast({ title: ubieLanguage === 'pt-BR' ? "Permissão Negada" : "Permission Denied", description: ubieLanguage === 'pt-BR' ? "Acesso ao microfone negado." : "Microphone access denied.", variant: "destructive" });
                 return;
             }
             permissionStatus.onchange = () => { 
                console.log("Microphone permission status changed to:", permissionStatus.state);
                setMicPermissionGranted(permissionStatus.state === 'granted');
             };
        }
        recognitionRef.current?.start();
      } catch (err: any) { 
        console.error("Error starting speech recognition:", err);
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') { 
            toast({ title: ubieLanguage === 'pt-BR' ? "Erro ao Iniciar Voz" : "Error Starting Voice", description: ubieLanguage === 'pt-BR' ? "Não foi possível iniciar o reconhecimento de voz." : "Could not start speech recognition.", variant: "destructive" });
        }
        setIsListening(false);
      }
    }
  };

  const handleSaveClick = () => {
    if (messages.length === 0) { return; }
    setSaveInputName(currentlyLoadedConversation?.name || '');
    setIsSavingPromptOpen(true);
  };

  const handleConfirmSave = () => {
      if (saveInputName.trim()) {
          saveConversation(saveInputName.trim());
          setIsSavingPromptOpen(false);
      }
  };

    const handleResumeConversation = (savedId: number) => { resumeSavedConversation(savedId); };
    const handleLoadConversation = (savedId: number) => { loadConversation(savedId); };

    const handleDeleteConversation = (savedId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        if (window.confirm(ubieLanguage === 'pt-BR' ? "Tem certeza que deseja deletar esta conversa?" : "Are you sure you want to delete this conversation?")) {
            deleteConversation(savedId);
        }
    };

  if (!isAgentPanelOpen) { return null; }
  const isViewingSaved = currentlyLoadedConversation !== null;

  return (
    <div className="fixed bottom-4 right-4 w-80 h-[calc(100vh-theme(space.16))] max-h-[600px] bg-[hsl(var(--sidebar-background))] !bg-[hsl(var(--sidebar-background))] rounded-lg shadow-neumorphic-outset flex flex-col z-50 text-[hsl(var(--sidebar-foreground))]">
      <div className="flex justify-between items-center p-3 border-b border-[hsl(var(--sidebar-border))]">
         <div className="flex items-center">
            <div className="relative h-6 w-6 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center mr-2" style={iconNeonFilterStyle}>
                 <Image src="/character.png" alt="Ubie Icon" fill style={{ objectFit: 'cover' }} sizes="24px" priority />
             </div>
             <h3 className="text-lg font-semibold"> Ubie </h3>
         </div>
         <div className="flex items-center space-x-1">
            <Select value={ubieLanguage} onValueChange={(value) => setUbieLanguage(value as 'pt-BR' | 'en-US')}>
                <SelectTrigger className="w-auto h-7 px-2 py-1 text-xs bg-transparent border-none shadow-none hover:bg-[hsl(var(--sidebar-accent))] focus:ring-0" aria-label={ubieLanguage === 'pt-BR' ? "Selecionar Idioma do Ubie" : "Select Ubie Language"} >
                    <Languages className="h-3.5 w-3.5 mr-1" style={iconNeonFilterStyle} />
                    <SelectValue placeholder="Lang" />
                </SelectTrigger>
                <SelectContent className="min-w-[60px] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))]">
                    <SelectItem value="pt-BR" className="text-xs cursor-pointer">PT</SelectItem>
                    <SelectItem value="en-US" className="text-xs cursor-pointer">EN</SelectItem>
                </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1.5 h-7 text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-[hsl(var(--sidebar-accent))]">
                  <History className="h-4 w-4" style={iconNeonFilterStyle} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 bg-[hsl(var(--popover))] !bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-xl rounded-md border border-[hsl(var(--border))]">
                <DropdownMenuItem onClick={startNewConversation} className="text-xs flex items-center cursor-pointer hover:!bg-[hsl(var(--accent))] hover:!text-[hsl(var(--accent-foreground))]">
                  <PlusCircle className="mr-2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" /> {ubieLanguage === 'pt-BR' ? 'Nova Conversa' : 'New Chat'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSaveClick} disabled={messages.length === 0} className="text-xs flex items-center cursor-pointer hover:!bg-[hsl(var(--accent))] hover:!text-[hsl(var(--accent-foreground))]">
                  <Save className="mr-2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" /> {ubieLanguage === 'pt-BR' ? 'Salvar Atual' : 'Save Current'}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
                <DropdownMenuLabel className="text-xs font-semibold text-[hsl(var(--muted-foreground))] px-2 py-1">{ubieLanguage === 'pt-BR' ? 'Conversas Salvas' : 'Saved Chats'}</DropdownMenuLabel>
                {savedConversations.length === 0 ? ( <DropdownMenuItem disabled className="text-xs italic text-[hsl(var(--muted-foreground))]"> {ubieLanguage === 'pt-BR' ? 'Nenhuma salva.' : 'None saved.'} </DropdownMenuItem>
                ) : (
                    <ScrollArea className="h-32 pr-2">
                        {savedConversations.map((conv) => (
                            <div key={conv.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded-sm ${currentlyLoadedConversation?.id === conv.id ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'hover:!bg-[hsl(var(--accent))] hover:!text-[hsl(var(--accent-foreground))]'}`}>
                                <span className="flex-1 truncate pr-2 cursor-pointer" onClick={() => handleLoadConversation(conv.id)} title={ubieLanguage === 'pt-BR' ? `Visualizar: ${conv.name}` : `View: ${conv.name}`} > {conv.name} </span>
                                 <Button variant="ghost" size="sm" onClick={() => handleResumeConversation(conv.id)} title={ubieLanguage === 'pt-BR' ? "Retomar conversa" : "Resume chat"} className="text-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] p-1 h-auto"> <ArrowRight className="h-3 w-3" /> </Button>
                                <Button variant="ghost" size="sm" onClick={(e) => handleDeleteConversation(conv.id, e)} title={ubieLanguage === 'pt-BR' ? "Deletar conversa" : "Delete chat"} className="text-red-400 hover:text-red-300 p-1 h-auto"> <Trash2 className="h-3 w-3" /> </Button>
                            </div>
                        ))}
                    </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => toggleAgentPanel()} className="p-1.5 h-7 text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-[hsl(var(--sidebar-accent))]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/> </svg>
            </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3 bg-[hsl(var(--sidebar-background))] !bg-[hsl(var(--sidebar-background))]">
        {isViewingSaved && currentlyLoadedConversation && ( <div className="text-center text-xs text-[hsl(var(--muted-foreground))] mb-2 italic"> {ubieLanguage === 'pt-BR' ? 'Visualizando conversa salva:' : 'Viewing saved chat:'} "{currentlyLoadedConversation.name}" </div> )}
        
        {messages.map((msg: ChatMessageType) => ( // Usando ChatMessageType importado de @/types/chat
          <ChatMessage
            key={msg.id}
            message={msg}
          />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="p-3 border-t border-[hsl(var(--sidebar-border))] flex items-center bg-[hsl(var(--sidebar-background))] !bg-[hsl(var(--sidebar-background))]">
        {speechApiSupported && (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleListen}
                className={`mr-2 p-2 h-auto ${isListening ? 'text-red-500 hover:text-red-400' : 'text-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]'}`}
                title={isListening ? (ubieLanguage === 'pt-BR' ? "Parar Gravação" : "Stop Recording") : (ubieLanguage === 'pt-BR' ? "Gravar Voz" : "Record Voice")}
                disabled={isLoading}
            >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
        )}
        <Input
          type="text"
          placeholder={isListening ? (ubieLanguage === 'pt-BR' ? 'Ouvindo...' : 'Listening...') : (ubieLanguage === 'pt-BR' ? 'Pergunte ao Ubie...' : 'Ask Ubie...')}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className="flex-1 mr-2 text-sm p-2 rounded-md bg-[hsl(var(--element-bg-inset))] border border-transparent shadow-neumorphic-inset focus:outline-none focus:ring-0 text-[hsl(var(--element-foreground))] placeholder-[hsl(var(--muted-foreground))]"
          disabled={isLoading || isListening}
        />
        <Button type="submit" disabled={!inputMessage.trim() || isLoading || isListening} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-[hsl(var(--primary-foreground))] rounded-md p-2">
          {isLoading ? ( <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
          ) : ( <Send className="h-4 w-4" /> )}
        </Button>
      </form>
       <Dialog open={isSavingPromptOpen} onOpenChange={setIsSavingPromptOpen}>
           <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--popover))] !bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-[hsl(var(--border))]">
               <DialogHeader> <DialogTitle className="text-[hsl(var(--foreground))]">{ubieLanguage === 'pt-BR' ? 'Salvar Conversa' : 'Save Chat'}</DialogTitle> </DialogHeader>
               <div className="grid gap-4 py-4">
                   <Input id="conversationName" placeholder={ubieLanguage === 'pt-BR' ? 'Nome da conversa...' : 'Conversation name...'} value={saveInputName} onChange={(e) => setSaveInputName(e.target.value)} className="col-span-3 bg-[hsl(var(--element-bg-inset))] border border-[hsl(var(--element-border))] text-[hsl(var(--element-foreground))] placeholder-[hsl(var(--muted-foreground))] shadow-neumorphic-inset focus:outline-none focus:ring-0" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmSave(); } }} />
               </div>
               <DialogFooter>
                   <Button variant="outline" onClick={() => setIsSavingPromptOpen(false)} className="bg-[hsl(var(--element-bg))] text-[hsl(var(--element-foreground))] border border-[hsl(var(--element-border))] hover:bg-[hsl(var(--element-bg-raised))] shadow-neumorphic-outset">{ubieLanguage === 'pt-BR' ? 'Cancelar' : 'Cancel'}</Button>
                   <Button onClick={handleConfirmSave} disabled={!saveInputName.trim()} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-[hsl(var(--primary-foreground))]">{ubieLanguage === 'pt-BR' ? 'Salvar' : 'Save'}</Button>
               </DialogFooter>
           </DialogContent>
       </Dialog>
    </div>
  );
};

export default MCPAgent;
