// pages/Chat.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout';
import type { Campaign } from '@/entities/Campaign';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import { Send, User, Sparkles, Brain, Database, RefreshCw, RotateCw, Loader2, MessageSquare, History, Trash2, Save, Zap } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import { Message } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

interface Conversation { id: string; title: string; date: string; messages: Message[]; }
interface SimpleCampaignChatInfo { id?: string | number; name?: string | null; platform?: any | null; daily_budget?: number | null; duration?: number | null; objective?: any | null; }
interface CopyInfo { id?: string | number; campaign_id?: string | number; title?: string | null; cta?: string | null; target_audience?: string | null; content?: string | null; }
interface ChatPageProps {}
type CampaignOption = Pick<Campaign, 'id' | 'name'>;

export default function ChatPage({ }: ChatPageProps) {
    const { isAuthenticated, isLoading: authLoading, token } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [messages, setMessages] = useState<Message[]>([
        { 
            id: uuidv4(),
            role: 'assistant', 
            content: 'Olá! Sou o assistente USBABC IA. Como posso ajudar?',
            timestamp: Date.now()
        }
    ]);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState('Aguardando dados...');
    const [apiStatus, setApiStatus] = useState('Verificando...');
    const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
    const [activeTab, setActiveTab] = useState("chat");
    
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [contextCampaignId, setContextCampaignId] = useState<string>("__general__");
    const [contextLoading, setContextLoading] = useState<boolean>(false);
    const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
    const [pageError, setPageError] = useState<string | null>(null);
    
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    const API_LLM_URL = '/api/llm';
    const API_CAMPAIGNS_URL = '/api/campaigns';
    const API_COPIES_URL = '/api/copies';

    const neonColor = '#1E90FF';
    const neonColorMuted = '#4682B4';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const insetCardStyle = "bg-[#141414]/50 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] rounded-md border-none";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9 text-sm px-3 py-2";
    const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out h-9 px-3 text-sm";
    const neumorphicGhostButtonStyle = cn(neumorphicButtonStyle, "bg-transparent shadow-none hover:bg-[#1E90FF]/20 hover:text-[#1E90FF] h-8 w-8 p-0");
    const primaryNeumorphicButtonStyle = cn(neumorphicButtonStyle, "bg-[#1E90FF]/80 hover:bg-[#1E90FF]/100");
    const tabsListStyle = "bg-[#141414]/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] rounded-lg p-1 h-auto";
    const tabsTriggerStyle = "data-[state=active]:bg-[#1E90FF]/30 data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.05)] data-[state=active]:text-white text-gray-400 hover:text-white hover:bg-[#1E90FF]/10 rounded-md px-3 py-1.5 text-sm transition-all duration-150";
    const primaryIconStyle = { filter: `drop-shadow(0 0 3px ${neonColor})` };

    const fetchCampaignOptions = useCallback(async () => {
        console.log("[ChatPage] fetchCampaignOptions - Token:", token ? token.substring(0,10)+"..." : "Token NULO/UNDEFINED");
        if (!token) {
            console.warn("[ChatPage] fetchCampaignOptions chamado sem token. Abortando.");
            setCampaignsLoading(false);
            return;
        }
        console.log("[ChatPage] Iniciando fetchCampaignOptions...");
        setCampaignsLoading(true);
        setPageError(null);
        try {
            const response = await axios.get<CampaignOption[]>(`${API_CAMPAIGNS_URL}?fields=id,name`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000 
            });
            if (response.status !== 200 || !Array.isArray(response.data)) {
                throw new Error(`Falha ao buscar campanhas (Status: ${response.status})`);
            }
            const validOptions = response.data.filter(camp => camp.id != null && camp.name != null);
            setCampaignOptions(validOptions);
            console.log("[ChatPage] Campaign options carregadas:", validOptions.length);
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || "Falha ao buscar campanhas.";
            setPageError(`Erro Crítico ao Carregar Campanhas: ${errorMsg}.`);
            toast({ title: "Erro Crítico de Dados", description: errorMsg, variant: "destructive", duration: 10000 });
            setCampaignOptions([]);
            console.error("[ChatPage] Erro em fetchCampaignOptions:", error.response?.data || error.toJSON?.() || error);
        } finally {
            setCampaignsLoading(false);
            console.log("[ChatPage] fetchCampaignOptions finalizado.");
        }
    }, [API_CAMPAIGNS_URL, toast, token]);

    const generateContext = useCallback(async () => {
        console.log("[ChatPage] generateContext - Token:", token ? token.substring(0,10)+"..." : "Token NULO/UNDEFINED");
        if (campaignsLoading || !isAuthenticated || !token) { 
            console.log("[ChatPage] generateContext SKIPPED (pré-condições não atendidas):", { campaignsLoading, isAuthenticated, hasToken: !!token });
            if (!contextLoading) setContext("Contexto não pôde ser carregado (dados de campanha pendentes ou não autenticado).");
            return;
        }
        console.log(`[ChatPage] Iniciando generateContext para campaignId: ${contextCampaignId}`);
        setContextLoading(true); 
        setContext("Carregando contexto..."); 
        let contextData = "Contexto não disponível.";
        try {
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };
            let campaignSummary = "Resumo das campanhas não carregado.\n"; 
            let copySummary = "\nResumo dos textos não carregado.\n"; 

            if (contextCampaignId === "__general__") {
                console.log("[ChatPage] generateContext: Fetching general campaigns (DEBUG)...");
                try {
                    const campaignsResponse = await axios.get(`${API_CAMPAIGNS_URL}?limit=3&sort=created_at:desc`, { ...authHeader, timeout: 15000 });
                    const campaigns: SimpleCampaignChatInfo[] = campaignsResponse.data || [];
                    console.log(`[ChatPage] generateContext: Fetched ${campaigns.length} general campaigns. Status: ${campaignsResponse.status}`);
                    campaignSummary = "Resumo das 3 campanhas mais recentes:\n";
                    if (campaigns.length === 0) campaignSummary += "Nenhuma campanha disponível.\n";
                    else campaigns.forEach((camp, i) => campaignSummary += `${i + 1}. Nome: ${camp.name || 'N/A'}, Plataforma: ${Array.isArray(camp.platform) ? camp.platform.join(', ') : camp.platform || 'N/A'}, Objetivo: ${Array.isArray(camp.objective) ? camp.objective.join(', ') : camp.objective || 'N/A'}\n`);
                } catch (campaignError: any) {
                    console.error("[ChatPage] generateContext - Erro ao buscar CAMPANHAS GERAIS:", campaignError.response?.data || campaignError.toJSON?.() || campaignError.message || campaignError);
                    campaignSummary = "Erro ao carregar resumo de campanhas.\n";
                    toast({ title: "Erro (Campanhas)", description: campaignError.message || "Falha ao buscar campanhas.", variant: "destructive" });
                }
                
                console.log("[ChatPage] generateContext: Fetching general copies...");
                try {
                    const copiesResponse = await axios.get(`${API_COPIES_URL}?limit=3&sort=created_at:desc`, { ...authHeader, timeout: 15000 });
                    const copies: CopyInfo[] = copiesResponse.data || [];
                    console.log(`[ChatPage] generateContext: Fetched ${copies.length} general copies. Status: ${copiesResponse.status}`);
                    copySummary = "\nResumo dos 3 textos mais recentes:\n";
                    if (copies.length === 0) copySummary += "Nenhum texto disponível.\n";
                    else copies.forEach((copy, i) => {
                        copySummary += `${i + 1}. Título: ${copy.title || 'N/A'}, Público: ${copy.target_audience || 'N/A'}\n`;
                        if (copy.content) copySummary += `   Conteúdo: ${copy.content.substring(0, 50)}...\n`;
                    });
                } catch (copyError: any) {
                    console.error("[ChatPage] generateContext - Erro ao buscar CÓPIAS GERAIS:", copyError.response?.data || copyError.toJSON?.() || copyError.message || copyError);
                    copySummary = "\nErro ao carregar resumo de textos.\n";
                    toast({ title: "Erro (Textos)", description: copyError.message || "Falha ao buscar textos.", variant: "destructive" });
                }
                contextData = campaignSummary + copySummary;

            } else { 
                console.log(`[ChatPage] generateContext: Fetching specific campaign ${contextCampaignId}...`);
                try {
                    const campaignResponse = await axios.get(`${API_CAMPAIGNS_URL}?id=${contextCampaignId}`, { ...authHeader, timeout: 15000 });
                    const campaign: SimpleCampaignChatInfo | null = (campaignResponse.status === 200 && campaignResponse.data && campaignResponse.data.id) ? campaignResponse.data : null;
                    
                    if (campaign) {
                        console.log(`[ChatPage] generateContext: Fetched campaign ${campaign?.name}. Status: ${campaignResponse.status}`);
                        let campaignDetail = `Detalhes da Campanha "${campaign.name || 'N/A'}":\n`;
                        campaignDetail += `Plataforma: ${Array.isArray(campaign.platform) ? campaign.platform.join(', ') : campaign.platform || 'N/A'}\nOrçamento: R$ ${campaign.daily_budget?.toFixed(2) || 'N/A'} / dia\nDuração: ${campaign.duration || 'N/A'} dias\nObjetivo: ${Array.isArray(campaign.objective) ? campaign.objective.join(', ') : campaign.objective || 'N/A'}\n`;
                        
                        console.log(`[ChatPage] generateContext: Fetching copies for campaign ${contextCampaignId}...`);
                        const copiesResponse = await axios.get(`${API_COPIES_URL}?campaign_id=${contextCampaignId}`, { ...authHeader, timeout: 15000 });
                        const copies: CopyInfo[] = copiesResponse.data || [];
                        console.log(`[ChatPage] generateContext: Fetched ${copies.length} copies. Status: ${copiesResponse.status}`);
                        let specCopySummary = "\nTextos desta campanha:\n";
                        if (copies.length === 0) specCopySummary += "Nenhum texto para esta campanha.\n";
                        else copies.forEach((copy, i) => {
                            specCopySummary += `${i + 1}. Título: ${copy.title || 'N/A'}, CTA: ${copy.cta || 'N/A'}\n`;
                        });
                        contextData = campaignDetail + specCopySummary;
                    } else {
                        console.warn(`[ChatPage] generateContext: Campanha específica ID ${contextCampaignId} não encontrada ou resposta inesperada. Status: ${campaignResponse.status}, Data:`, campaignResponse.data);
                        contextData = `Detalhes da campanha ID ${contextCampaignId} não encontrados. (Status: ${campaignResponse.status})`;
                        toast({ title: "Aviso", description: `Campanha ID ${contextCampaignId} não encontrada.`, variant: "default" });
                    }

                } catch (specificContextError: any) {
                    let errorDetails = "Detalhes indisponíveis";
                    if (axios.isAxiosError(specificContextError)) {
                        if (specificContextError.response) {
                            errorDetails = `Status: ${specificContextError.response.status}, Data: ${JSON.stringify(specificContextError.response.data)}`;
                        } else if (specificContextError.request) {
                            errorDetails = "Sem resposta do servidor (possível erro de rede ou timeout).";
                        } else {
                            errorDetails = specificContextError.message;
                        }
                    } else {
                        errorDetails = specificContextError.message || String(specificContextError);
                    }
                    console.error(`[ChatPage] generateContext - Erro ao buscar contexto específico para Campanha ID ${contextCampaignId}:`, errorDetails, specificContextError);
                    contextData = `Erro ao carregar detalhes da campanha ${contextCampaignId}. (${specificContextError.response?.status || 'Erro de rede/config.'})`;
                    toast({ title: "Erro (Contexto Específico)", description: `Falha ao buscar dados para campanha ID ${contextCampaignId}. Detalhes: ${errorDetails.substring(0,100)}...`, variant: "destructive" });
                }
            }
            console.log("[ChatPage] generateContext: Context data compiled:", contextData.substring(0, 200) + "...");
        } catch (overallError: any) { 
            const errorMsg = overallError.message || "Erro geral desconhecido em generateContext";
            contextData = `Erro crítico ao montar contexto: ${errorMsg}`;
            console.error("[ChatPage] generateContext OVERALL ERROR:", overallError);
            toast({ title: "Erro Crítico de Contexto", description: errorMsg, variant: "destructive" });
        } finally {
            setContext(contextData);
            setContextLoading(false);
            console.log("[ChatPage] generateContext FINISHED. contextLoading set to false. Final context snippet:", contextData.substring(0,100)+"...");
        }
    }, [API_CAMPAIGNS_URL, API_COPIES_URL, contextCampaignId, toast, campaignsLoading, isAuthenticated, token]);

    const checkApiStatus = useCallback(async () => {
        console.log("[ChatPage] Iniciando checkApiStatus...");
        setApiStatus('Verificando...');
        try {
            const response = await axios.get(`${API_LLM_URL}/health`, { timeout: 7000 }); 
            if (response.data?.status === 'ok' && response.status === 200) {
                 setApiStatus(response.data?.message ||'IA Operacional');
                 console.log("[ChatPage] checkApiStatus: Operacional - ", response.data?.message);
            } else {
                setApiStatus(`API IA: Erro (${response.status} - ${response.data?.error || response.data?.status || 'Resposta inesperada'})`);
                console.warn("[ChatPage] checkApiStatus: Erro/Inesperado - ", response.status, response.data);
            }
        } catch (error: any) {
            let statusMsg = 'API IA: Erro Desconhecido na Verificação';
            if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') statusMsg = 'API IA: Timeout';
            else if (axios.isAxiosError(error) && error.response) {
                statusMsg = `API IA: Erro (${error.response.status} - ${error.response.data?.error || error.response.data?.status || 'Não encontrado ou erro'})`;
            }
            else if (axios.isAxiosError(error) && error.request) statusMsg = 'API IA: Offline/Sem Resposta';
            setApiStatus(statusMsg);
            console.error("[ChatPage] Erro em checkApiStatus:", error.response?.data || error.message || error);
        } finally {
            console.log("[ChatPage] checkApiStatus finalizado.");
        }
    }, [API_LLM_URL]);

    const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
        ref.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async () => {
        console.log("[ChatPage] handleSendMessage - Token:", token ? token.substring(0,10)+"..." : "Token NULO/UNDEFINED");
        if (!input.trim() || loading || !token) {
            if(!token) console.warn("[ChatPage] handleSendMessage: Tentativa de enviar mensagem sem token.");
            return;
        }

        const userMessage: Message = { id: uuidv4(), role: 'user', content: input.trim(), timestamp: Date.now() };
        setMessages(prev => [...prev, userMessage]);
        setLoading(true);
        const currentInput = input;
        setInput('');
        console.log("[ChatPage] Enviando mensagem:", currentInput);

        try {
            const currentContext = contextLoading ? "Aguardando carregamento do contexto..." : context;
            const prompt = `CONTEXTO DE MARKETING ATUAL:\n${currentContext}\n\nPERGUNTA DO USUÁRIO (BASEADA NO CONTEXTO ACIMA):\n${currentInput}`;
            
            const requestBody = {
                prompt: prompt,
                history: messages.slice(-10).map(m => ({role: m.role, content: m.content}))
            };

            const response = await axios.post(API_LLM_URL, requestBody, { 
                timeout: 90000,
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const assistantResponse: Message = { 
                id: uuidv4(), 
                role: 'assistant', 
                content: response.data?.text || "Desculpe, não consegui processar sua solicitação.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, assistantResponse]);
            console.log("[ChatPage] Resposta da IA recebida:", assistantResponse.content.substring(0,100)+"...");

        } catch (error: any) {
            let errorMsg = "Falha ao comunicar com a IA.";
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                errorMsg = error.response.data.error;
            } else if (error.message) {
                errorMsg = error.message;
            }
            setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: `Erro: ${errorMsg}`, error: errorMsg, timestamp: Date.now() }]);
            toast({ title: "Erro na Comunicação com IA", description: errorMsg, variant: "destructive", duration: 7000 });
            console.error("[ChatPage] Erro em handleSendMessage:", error.response?.data || error);
        } finally {
            setLoading(false);
            requestAnimationFrame(() => scrollToBottom(chatEndRef));
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const saveConversation = () => {
        if (messages.length <= 1) {
            toast({ title: "Conversa vazia", description: "Não há mensagens para salvar", variant: "default" });
            return;
        }
        const newConversation: Conversation = {
            id: uuidv4(),
            title: messages.find(m => m.role === 'user')?.content.substring(0, 30) + (messages.find(m => m.role === 'user')?.content.length > 30 ? '...' : '') || `Conversa ${new Date().toLocaleTimeString()}`,
            date: new Date().toISOString(),
            messages: [...messages]
        };
        const updatedConversations = [...savedConversations, newConversation];
        setSavedConversations(updatedConversations);
        try {
            localStorage.setItem('savedConversations_usbMktChat', JSON.stringify(updatedConversations));
            toast({ title: "Conversa salva", description: "Você pode acessá-la na aba Histórico" });
        } catch (e) {
            console.error("Erro ao salvar conversa no localStorage:", e);
            toast({ title: "Erro ao Salvar", description: "Não foi possível salvar no localStorage.", variant: "destructive" });
        }
    };

    const loadSavedConversations = useCallback(() => {
        console.log("[ChatPage] Carregando conversas salvas do localStorage...");
        try {
            const saved = localStorage.getItem('savedConversations_usbMktChat');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every(conv => conv.id && conv.title && conv.date && Array.isArray(conv.messages))) {
                    setSavedConversations(parsed);
                    console.log(`[ChatPage] ${parsed.length} conversas carregadas.`);
                } else {
                    console.warn("[ChatPage] Formato inválido das conversas salvas no localStorage. Removendo item.");
                    localStorage.removeItem('savedConversations_usbMktChat');
                }
            } else {
                console.log("[ChatPage] Nenhuma conversa salva encontrada no localStorage.");
            }
        } catch (e) {
            console.error("[ChatPage] Erro ao carregar conversas do localStorage:", e);
            toast({ title: "Erro ao Carregar Histórico", description: "Não foi possível ler o histórico salvo.", variant: "destructive" });
        }
    }, [toast]);

    const loadConversation = (id: string) => {
        const conversation = savedConversations.find(conv => conv.id === id);
        if (conversation) {
            setMessages(conversation.messages);
            setActiveTab('chat');
            toast({ title: "Conversa carregada", description: `Conversa "${conversation.title}" restaurada.` });
            requestAnimationFrame(() => scrollToBottom(chatEndRef));
        } else {
            toast({ title: "Erro", description: "Conversa não encontrada.", variant: "destructive" });
        }
    };

    const deleteConversation = (id: string) => {
        const updatedConversations = savedConversations.filter(conv => conv.id !== id);
        setSavedConversations(updatedConversations);
        try {
            localStorage.setItem('savedConversations_usbMktChat', JSON.stringify(updatedConversations));
            toast({ title: "Conversa removida", description: "A conversa foi removida do histórico" });
        } catch (e) {
            console.error("Erro ao remover conversa do localStorage:", e);
            toast({ title: "Erro ao Remover", description: "Não foi possível atualizar o histórico salvo.", variant: "destructive" });
        }
    };

    const clearConversation = () => {
        setMessages([{ id: uuidv4(), role: 'assistant', content: 'Chat limpo. Como posso ajudar?', timestamp: Date.now() }]);
        toast({ title: "Chat limpo", description: "Todas as mensagens foram removidas" });
    };

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated) {
            console.log("[ChatPage] Autenticado. Carregando dados iniciais.");
            loadSavedConversations();
            fetchCampaignOptions(); 
            checkApiStatus();
        }
    }, [authLoading, isAuthenticated, router, loadSavedConversations, fetchCampaignOptions, checkApiStatus]);

    useEffect(() => {
        // Só gera contexto se autenticado, sem erro na página, e se as opções de campanha já foram carregadas
        // E se o contexto não estiver já carregando.
        if (isAuthenticated && !pageError && !campaignsLoading && !contextLoading) {
            console.log("[ChatPage] Disparando generateContext. contextCampaignId:", contextCampaignId, "campaignsLoading:", campaignsLoading, "contextLoading:", contextLoading);
            generateContext();
        }
    }, [isAuthenticated, pageError, campaignsLoading, contextCampaignId, token]); // Removido generateContext e contextLoading

    useEffect(() => { scrollToBottom(chatEndRef); }, [messages]);

    if (authLoading) return <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">Verificando autenticação...</span></div></Layout>;
    if (!isAuthenticated && !authLoading) return null;
    if (pageError) return <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center text-center text-red-400 p-6"><div><h2 className="text-lg font-semibold mb-2">Erro Crítico</h2><p className="text-sm">{pageError}</p><Button onClick={fetchCampaignOptions} className={cn(primaryNeumorphicButtonStyle, 'mt-4')}><RefreshCw className="mr-2 h-4 w-4" /> Tentar Recarregar Campanhas</Button></div></div></Layout>;

    return (
        <Layout>
            <Head><title>Chat IA - USBMKT</title></Head>
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>USBABC IA MKT DIGITAL</h1>
                    <div className={cn(insetCardStyle, "p-1.5 px-3 rounded-full flex items-center gap-1.5 text-xs")}>
                        <Zap className={cn("h-3.5 w-3.5 flex-shrink-0", apiStatus.includes('Operacional') || apiStatus.includes('configurada') ? 'text-green-400 animate-pulse' : apiStatus.includes('Erro') || apiStatus.includes('Offline') || apiStatus.includes('Timeout') ? 'text-red-400' : 'text-yellow-400')} style={primaryIconStyle} />
                        <span className="text-gray-300 truncate" title={apiStatus}>{apiStatus}</span>
                        <Button variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle, "h-5 w-5 p-0 flex-shrink-0")} onClick={checkApiStatus} title="Verificar Status da API IA"><RefreshCw className="h-3 w-3" /></Button>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-4">
                    <div className="lg:col-span-3 space-y-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className={cn(tabsListStyle, "grid grid-cols-2")}>
                                <TabsTrigger value="chat" className={tabsTriggerStyle}>Chat Principal</TabsTrigger>
                                <TabsTrigger value="history" className={tabsTriggerStyle}>Histórico</TabsTrigger>
                            </TabsList>
                            <TabsContent value="chat">
                                <Card className={cn(cardStyle, "overflow-hidden")}>
                                    <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-[#1E90FF]/20">
                                        <div className="flex items-center gap-2"><div className={cn(insetCardStyle, "p-1.5 rounded-md flex-shrink-0")}><Brain className="h-5 w-5 text-primary" style={primaryIconStyle} /></div><CardTitle className="text-base font-semibold text-white truncate" style={{ textShadow: `0 0 5px ${neonColorMuted}` }}>Chat com Contexto</CardTitle></div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <Select value={contextCampaignId} onValueChange={(val) => setContextCampaignId(val)} disabled={contextLoading || campaignsLoading}>
                                                <SelectTrigger className={cn(neumorphicInputStyle, "h-7 w-[160px] md:w-[180px] bg-[#141414]/60 text-xs")} title={contextCampaignId === "__general__" ? "Contexto Geral" : campaignOptions.find(c => String(c.id) === contextCampaignId)?.name ?? "Selecionar Contexto"}><SelectValue placeholder={campaignsLoading ? "Carregando..." : "Selecione o contexto"} /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__general__">Contexto Geral</SelectItem>
                                                    {campaignOptions.map(camp => (<SelectItem key={String(camp.id)} value={String(camp.id)}>{camp.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={generateContext} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Recarregar Contexto" disabled={contextLoading || campaignsLoading}>{contextLoading || campaignsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}</Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0"><div className="grid grid-cols-1 md:grid-cols-3">
                                        <div className="md:col-span-2 overflow-hidden border-b md:border-r md:border-b-0 border-[#1E90FF]/10">
                                            <ScrollArea className="h-[calc(100vh-345px)] md:h-[calc(100vh-280px)] p-4"><div className="space-y-4">
                                                {messages.map((msg, i) => (<ChatMessage key={msg.id || i} message={msg} />))}
                                                {loading && (<div className="flex items-center justify-start py-2 pl-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Pensando...</span></div>)}
                                                <div ref={chatEndRef} />
                                            </div></ScrollArea>
                                        </div>
                                        <div className={cn(insetCardStyle, "md:col-span-1 p-3")}>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-primary"><Database className="h-4 w-4" style={primaryIconStyle} />Contexto de Marketing</h3>
                                            <ScrollArea className="h-[150px] md:h-[calc(100vh-330px)]"><div className="text-xs text-gray-400 whitespace-pre-wrap font-mono break-words">
                                                {contextLoading ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2">Carregando...</span></div>) : context}
                                            </div></ScrollArea>
                                        </div>
                                    </div></CardContent>
                                    <CardFooter className="p-2 flex items-center gap-2 border-t border-[#1E90FF]/20">
                                        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite sua mensagem aqui..." className={cn(neumorphicInputStyle, "flex-1")} disabled={loading || contextLoading}/>
                                        <Button onClick={handleSendMessage} className={cn(primaryNeumorphicButtonStyle, "min-w-[40px]")} disabled={loading || !input.trim() || contextLoading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                                        <Button onClick={saveConversation} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Salvar Conversa"><Save className="h-4 w-4" /></Button>
                                        <Button onClick={clearConversation} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Limpar Chat"><Trash2 className="h-4 w-4" /></Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                           
                            <TabsContent value="history">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader className="p-4"><CardTitle className="text-base font-semibold flex items-center gap-2"><History className="h-5 w-5" style={primaryIconStyle} />Histórico de Conversas Salvas</CardTitle></CardHeader>
                                    <CardContent className="p-4 pt-0"><ScrollArea className="h-[calc(100vh-265px)] pr-3">
                                        {savedConversations.length === 0 ? (<div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><MessageSquare className="h-8 w-8 mb-2 opacity-50" /><p className="text-center text-sm">Nenhuma conversa salva ainda.</p></div>)
                                        : (<div className="space-y-2">{[...savedConversations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((conv) => (<Card key={conv.id} className={cn(insetCardStyle, "p-3")}><div className="flex items-center justify-between gap-2"><div className="flex-1 overflow-hidden"><h3 className="text-sm font-medium truncate" title={conv.title}>{conv.title}</h3><p className="text-xs text-muted-foreground">{format(parseISO(conv.date), "dd/MM/yy HH:mm", { locale: ptBR })}</p></div><div className="flex gap-1 flex-shrink-0"><Button onClick={() => loadConversation(conv.id)} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle, "h-7 w-7")} title="Carregar Conversa"><MessageSquare className="h-3.5 w-3.5" /></Button><Button onClick={() => deleteConversation(conv.id)} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle, "h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-900/30")} title="Excluir Conversa"><Trash2 className="h-3.5 w-3.5" /></Button></div></div></Card>))}</div>)}
                                    </ScrollArea></CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <div className="space-y-4">
                        <Card className={cn(cardStyle)}>
                            <CardHeader className="p-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4" style={primaryIconStyle} />Sugestões de Prompts</CardTitle></CardHeader>
                            <CardContent className="p-3 pt-0"><div className="space-y-2 text-sm">{["Crie 3 títulos atrativos para um anúncio de Facebook sobre venda de cursos de marketing digital.","Analise o público-alvo ideal para uma campanha de marketing de imóveis de luxo.","Sugira 5 CTAs eficazes para uma landing page de venda de infoprodutos.","Crie um texto persuasivo de 3 parágrafos para email marketing sobre um workshop gratuito.","Quais são as melhores estratégias de remarketing para e-commerce em 2025?","Gere ideias de conteúdo para um blog sobre inteligência artificial aplicada ao marketing."].map((prompt, index) => (<Button key={index} variant="ghost" className={cn(insetCardStyle, "w-full justify-start text-left text-xs p-2 h-auto hover:bg-[#1E90FF]/10 hover:text-white")} onClick={() => { setInput(prompt); setActiveTab('chat'); }} title={`Usar no Chat Principal: ${prompt}`}>{prompt}</Button>))}</div></CardContent>
                        </Card>
                        <Card className={cn(cardStyle)}>
                            <CardHeader className="p-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" style={primaryIconStyle} />Dicas de Uso</CardTitle></CardHeader>
                            <CardContent className="p-3 pt-0"><ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside"><li>Selecione uma campanha no "Chat Principal" para respostas com contexto.</li><li>Detalhe bem suas perguntas para obter melhores resultados.</li><li>Salve conversas importantes no "Histórico".</li><li>Verifique o status da API IA no topo da página.</li></ul></CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
