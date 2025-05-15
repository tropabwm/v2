// pages/zap.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import Sidebar from "@/components/ui/sidebar";
import ElementCard from "@/components/dashboard/ElementCard";
import { cn } from "@/lib/utils";
import { 
    Users, Settings, BarChart2, Workflow, Send, Smartphone, PlugZap, Unplug, 
    Save, Play, Square, Check, Activity, ArrowRight, XCircle, Info, RefreshCw, 
    Search, Clock, HelpCircle, ExternalLinkIcon, UserCircle, Hourglass, Bell, ShieldCheck 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dynamic from 'next/dynamic';
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSettings, Contact } from '@/types/zap';
import {
    IconWithGlow,
    NEON_COLOR,
    NEON_GREEN,
    NEON_RED,
    NEON_COLOR_RGB, 
    baseButtonSelectStyle,
    baseCardStyle,
    baseInputInsetStyle,
    popoverContentStyle,
    customScrollbarStyle
} from '@/components/flow/utils';
import { LeftSidebarProvider, useLeftSidebarContext } from '@/context/LeftSidebarContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

const QRCodeDynamic = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <p className="text-xs text-gray-400" style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Carregando QR Code...</p>
});

interface ConnectionState {
    status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'error' | 'logging_out';
    qrCodeString: string | null;
    message: string | null;
    lastError?: string | null;
}

type PossiblePreviousStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'error';


function WhatsAppDashboard() {
    const { toast } = useToast();
    const { isLeftCollapsed } = useLeftSidebarContext();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState("dashboard");
    const [connectionState, setConnectionState] = useState<ConnectionState>({ 
        status: 'disconnected', 
        qrCodeString: null, 
        message: 'Verificando status inicial...' 
    });

    const [isProcessingAction, setIsProcessingAction] = useState(false);

    const [settings, setSettings] = useState<AppSettings>({
        defaultMessageDelayMs: 500,
        unknownMessageResponse: 'ignore',
        defaultReplyMessage: 'Desculpe, não entendi.',
        adminForwardNumber: '',
        defaultInputTimeoutSeconds: 60,
        enableBusinessHours: false,
        businessHoursStart: '09:00',
        businessHoursEnd: '18:00',
        outsideHoursMessage: 'Atendimento fora do horário.',
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [hasAttemptedContactFetch, setHasAttemptedContactFetch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const marginLeftClass = isLeftCollapsed ? `ml-16` : `ml-60`;

    const fetchConnectionStatus = useCallback(async (showToast = false, isUserAction = false) => {
        if (!isUserAction && (isProcessingAction || (typeof document !== 'undefined' && document.hidden))) {
            return;
        }
        try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || `Falha ao buscar status (HTTP ${response.status})`);
            }
            
            setConnectionState(prev => {
                if ((prev.status === 'connecting' || prev.status === 'disconnected') && data.qrCodeString) {
                    return {
                        status: 'qr',
                        qrCodeString: data.qrCodeString,
                        message: data.message || "Escaneie o QR Code.",
                        lastError: null
                    };
                }
                if (prev.status === 'qr' && !data.qrCodeString && data.status === 'connected') {
                     return {
                        status: 'connected',
                        qrCodeString: null,
                        message: data.message || "Conectado com sucesso!",
                        lastError: null
                    };
                }
                 if (prev.status === 'qr' && !data.qrCodeString && data.status !== 'connected') {
                     return {
                        status: data.status || 'disconnected',
                        qrCodeString: null,
                        message: data.message || "Conexão perdida ou falhou.",
                        lastError: data.status === 'error' ? (data.message || 'Erro no status') : prev.lastError
                    };
                }

                return {
                    status: data.status || 'error',
                    qrCodeString: data.qrCodeString || null,
                    message: data.message || null,
                    lastError: data.status === 'error' ? (data.message || 'Erro desconhecido no status') : null
                };
            });

        } catch (error: any) {
            console.error("[fetchConnectionStatus] Erro:", error.message);
            setConnectionState(prev => ({
                ...prev,
                status: 'error',
                message: 'Não foi possível obter o status do serviço WhatsApp.',
                qrCodeString: null,
                lastError: error.message
            }));
            if (showToast) {
                toast({ title: "Erro de Status", description: error.message, variant: "destructive" });
            }
        }
    }, [toast, isProcessingAction]);

    useEffect(() => {
        fetchConnectionStatus(false, true);
        const intervalId = setInterval(() => fetchConnectionStatus(false, false), 5000); 
        return () => clearInterval(intervalId);
    }, [fetchConnectionStatus]);

    const connectWhatsApp = useCallback(async () => {
        if (isProcessingAction || connectionState.status === 'connected' || connectionState.status === 'connecting' || connectionState.status === 'qr') return;
        setIsProcessingAction(true);
        setConnectionState({ status: 'connecting', message: 'Solicitando conexão...', qrCodeString: null, lastError: null });
        toast({ title: "Iniciando conexão..." });
        try {
            const response = await fetch('/api/whatsapp/connect', { method: 'POST' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || `Falha ao conectar (HTTP ${response.status})`);
            toast({ title: "Solicitação de Conexão Enviada", description: data.message || "Aguarde o QR code ou status." });
        } catch (error: any) {
            toast({ title: "Erro ao Conectar", description: error.message, variant: "destructive" });
            setConnectionState({ status: 'error', message: 'Falha ao solicitar conexão.', qrCodeString: null, lastError: error.message });
        } finally {
            setIsProcessingAction(false);
            setTimeout(() => fetchConnectionStatus(false, true), 1000); 
        }
    }, [toast, isProcessingAction, connectionState.status, fetchConnectionStatus]);

    const disconnectWhatsApp = useCallback(async () => {
        if (isProcessingAction || connectionState.status === 'disconnected' || connectionState.status === 'logging_out') return;
        
        setIsProcessingAction(true);
        // Salva o status *antes* de mudar para 'logging_out', pois é este que queremos reverter em caso de erro.
        const statusBeforeDisconnectAttempt = connectionState.status as PossiblePreviousStatus; 
        setConnectionState(prev => ({ ...prev, status: 'logging_out', message: 'Desconectando...', qrCodeString: null }));
        toast({ title: "Desconectando WhatsApp..." });
        try {
            const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || `Falha ao desconectar (HTTP ${response.status})`);
            toast({ title: "Desconexão Solicitada", description: data.message || "Sessão encerrada. Você pode conectar novamente." });
            setContacts([]); 
            setHasAttemptedContactFetch(false);
            setConnectionState({ status: 'disconnected', message: 'Desconectado. Pronto para nova conexão.', qrCodeString: null, lastError: null });
        } catch (error: any) {
            toast({ title: "Erro ao Desconectar", description: error.message, variant: "destructive" });
            // CORREÇÃO AQUI:
            // Se a API de desconexão falhar, reverte para o status que tínhamos ANTES de tentar o 'logging_out',
            // ou para 'error' se o status anterior já era problemático.
            setConnectionState({ 
                status: (statusBeforeDisconnectAttempt === 'connected' || statusBeforeDisconnectAttempt === 'qr' || statusBeforeDisconnectAttempt === 'connecting') ? statusBeforeDisconnectAttempt : 'error', 
                message: `Falha ao solicitar desconexão. (Status anterior: ${statusBeforeDisconnectAttempt})`, 
                qrCodeString: null, // Limpa QR em caso de erro
                lastError: error.message 
            });
        } finally {
            setIsProcessingAction(false);
            setTimeout(() => fetchConnectionStatus(false, true), 500); 
        }
    }, [toast, isProcessingAction, connectionState.status, fetchConnectionStatus]);

    const fetchContacts = useCallback(async () => {
        if (isLoadingContacts || connectionState.status !== 'connected') {
            if (connectionState.status !== 'connected') {
                setHasAttemptedContactFetch(false);
                setContacts([]);
            }
            return;
        }
        setIsLoadingContacts(true);
        setHasAttemptedContactFetch(true);
        try {
            const response = await fetch('/api/whatsapp/contacts');
            const data = await response.json(); 
            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || `Falha ao buscar contatos (HTTP ${response.status})`);
            }
            const contactsArray = Array.isArray(data.contacts) ? data.contacts : [];
            contactsArray.sort((a, b) => (a.name || a.notify || a.jid || '').localeCompare(b.name || b.notify || b.jid || ''));
            setContacts(contactsArray);
        } catch (error: any) {
            toast({ title: "Erro ao Carregar Contatos", description: error.message, variant: "destructive" });
            setContacts([]);
        } finally {
            setIsLoadingContacts(false);
        }
    }, [connectionState.status, isLoadingContacts, toast]);

    useEffect(() => {
        if (activeTab === 'contacts' && connectionState.status === 'connected' && !hasAttemptedContactFetch && !isLoadingContacts) {
            fetchContacts();
        }
        if (activeTab !== 'contacts' || connectionState.status !== 'connected') {
            setHasAttemptedContactFetch(false);
        }
    }, [activeTab, connectionState.status, hasAttemptedContactFetch, fetchContacts, isLoadingContacts]);

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contacts;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return contacts.filter(c =>
            (c.name && c.name.toLowerCase().includes(lowerSearchTerm)) ||
            (c.notify && c.notify.toLowerCase().includes(lowerSearchTerm)) ||
            (c.jid && c.jid.toLowerCase().includes(lowerSearchTerm))
        );
    }, [contacts, searchTerm]);

    const handleSettingChange = useCallback((key: keyof AppSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const saveSettings = useCallback(async () => {
        setIsSavingSettings(true);
        console.log("Salvando configurações (simulado):", settings);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            toast({ title: "Configurações Salvas (Simulado)", description: "A persistência real precisa ser implementada." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar Configurações", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingSettings(false);
        }
    }, [settings, toast]);

    useEffect(() => {
        console.log("Carregando configurações (simulado)...");
    }, []);

    const dashboardStatsValues = useMemo(() => ({
        activeConversations: 0, 
        messagesSent: 0,        
        messagesReceived: 0     
    }), []);

    const getStatusColor = (status: typeof connectionState.status) => {
        if (status === 'connected') return NEON_GREEN;
        if (status === 'connecting' || status === 'logging_out' || status === 'qr') return NEON_COLOR;
        if (status === 'disconnected' || status === 'error') return NEON_RED;
        return 'text-gray-400';
    };
    
    const getStatusIcon = (status: typeof connectionState.status) => {
        if (status === 'connected') return <Check className="h-4 w-4" style={{ color: NEON_GREEN, filter: `drop-shadow(0 0 3px ${NEON_GREEN})` }} />;
        if (status === 'connecting' || status === 'logging_out' || status === 'qr') return <Activity className="h-4 w-4 animate-spin" style={{ color: NEON_COLOR, filter: `drop-shadow(0 0 3px ${NEON_COLOR})` }} />;
        if (status === 'disconnected') return <XCircle className="h-4 w-4" style={{ color: NEON_RED, filter: `drop-shadow(0 0 3px ${NEON_RED})` }} />;
        if (status === 'error') return <Info className="h-4 w-4" style={{ color: NEON_RED, filter: `drop-shadow(0 0 3px ${NEON_RED})` }} />;
        return <Smartphone className="h-4 w-4 text-gray-400" />;
    };
    
    const capitalizedStatus = connectionState.status === 'qr' ? 'Aguardando QR' : (connectionState.status.charAt(0).toUpperCase() + connectionState.status.slice(1));
    
    const showDisconnectButton = 
        connectionState.status === 'connected' || 
        connectionState.status === 'qr' || 
        connectionState.status === 'logging_out' ||
        (connectionState.status === 'connecting' && connectionState.qrCodeString);

    return (
        <div className="flex h-screen bg-[#1a1a1a]">
            <Sidebar />
            <main className={cn(
                `flex-1 transition-all duration-300 ease-in-out ${marginLeftClass} p-4 flex flex-col gap-4 overflow-y-auto`,
                customScrollbarStyle
            )}>
                 <div className="flex justify-between items-center flex-shrink-0">
                    <h1 className="text-xl md:text-2xl font-bold text-white" style={{ textShadow: `0 0 6px ${NEON_COLOR}, 0 0 10px ${NEON_COLOR}` }}>
                        WhatsApp Dashboard
                    </h1>
                    <div className='flex items-center gap-2'>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <div className={cn(baseButtonSelectStyle, "h-8 px-3 rounded text-xs flex items-center gap-1.5 cursor-default")}
                                     style={{ borderColor: getStatusColor(connectionState.status), color: getStatusColor(connectionState.status) }}>
                                     {getStatusIcon(connectionState.status)}
                                     {capitalizedStatus}
                                 </div>
                            </TooltipTrigger>
                            <TooltipContent className={cn(popoverContentStyle, 'text-xs')}>
                                <p>{connectionState.message || "Status atual do serviço WhatsApp."}</p>
                                {connectionState.lastError && <p className='mt-1 text-red-400'>Erro: {connectionState.lastError}</p>}
                            </TooltipContent>
                        </Tooltip>

                        {showDisconnectButton ? (
                            <Button onClick={disconnectWhatsApp} variant="destructive" size="sm" className={cn(baseButtonSelectStyle, 'hover:!bg-red-500/30 !text-red-400 h-8 px-3')} disabled={isProcessingAction || connectionState.status === 'logging_out'}>
                                {isProcessingAction && connectionState.status === 'logging_out' ? <Activity className='mr-2 h-4 w-4 animate-spin' /> : <Unplug className='mr-2 h-4 w-4' style={{ filter: `drop-shadow(0 0 4px ${NEON_RED})` }}/>}
                                {connectionState.status === 'logging_out' ? 'Desconectando...' : 'Desconectar'}
                            </Button>
                        ) : (
                            <Button onClick={connectWhatsApp} variant="default" size="sm" className={cn(baseButtonSelectStyle, `hover:!bg-[rgba(${NEON_COLOR_RGB},0.3)] h-8 px-3`)} disabled={isProcessingAction || connectionState.status === 'connecting'}>
                                {isProcessingAction && connectionState.status === 'connecting' && !connectionState.qrCodeString ? <Activity className='mr-2 h-4 w-4 animate-spin' /> : <PlugZap className='mr-2 h-4 w-4' style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>}
                                {connectionState.status === 'connecting' && !connectionState.qrCodeString ? 'Conectando...' : 'Conectar WhatsApp'}
                            </Button>
                        )}
                         <Link href="/flow" passHref>
                            <Button variant="outline" size="sm" className={cn(baseButtonSelectStyle, `hover:!bg-[rgba(${NEON_COLOR_RGB},0.3)] h-8 px-3 text-xs`)}>
                                <Workflow className="mr-1.5 h-3.5 w-3.5" /> Editor de Fluxos
                            </Button>
                        </Link>
                    </div>
                </div>

                <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col space-y-3 min-h-0">
                    <TabsList className={cn("p-1 flex-shrink-0 rounded-lg w-full justify-start", baseInputInsetStyle)}>
                        <TabsTrigger value="dashboard" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[rgba(${NEON_COLOR_RGB},0.2)]`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <BarChart2 className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Dashboard </TabsTrigger>
                        <TabsTrigger value="contacts" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[rgba(${NEON_COLOR_RGB},0.2)]`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <Users className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Contatos </TabsTrigger>
                        <TabsTrigger value="settings" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[rgba(${NEON_COLOR_RGB},0.2)]`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <Settings className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Config. </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className={cn("flex-grow overflow-y-auto space-y-4 pr-1 min-h-0", customScrollbarStyle)}>
                        {connectionState.status === 'disconnected' && !isProcessingAction && (
                            <Card className={cn(baseCardStyle, "h-60 flex flex-col items-center justify-center text-center p-4")}>
                                <IconWithGlow icon={Unplug} className='h-12 w-12 mb-3' color={NEON_RED}/>
                                <p className="text-gray-300 text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>WhatsApp Desconectado.</p>
                                <p className="text-gray-400 text-xs mt-1" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>{connectionState.message || "Clique em 'Conectar WhatsApp' para iniciar."}</p>
                                {connectionState.lastError && <p className='text-xs text-red-400 mt-2'>Último erro: {connectionState.lastError}</p>}
                            </Card>
                        )}
                        {(connectionState.status === 'connecting' || connectionState.status === 'qr') && connectionState.qrCodeString && (
                            <div className={cn(baseCardStyle, "p-4 flex flex-col items-center justify-center")}>
                                <p className="text-white text-sm mb-3" style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Escaneie o QR Code com seu WhatsApp:</p>
                                <div className="bg-white p-2.5 rounded-lg shadow-lg">
                                    <QRCodeDynamic value={connectionState.qrCodeString} size={200} level={"M"} bgColor="#FFFFFF" fgColor="#0D0D0D" />
                                </div>
                                <p className="text-xs text-gray-400 mt-3" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>{connectionState.message || "Aguardando leitura..."}</p>
                            </div>
                        )}
                        {(connectionState.status === 'connecting' || connectionState.status === 'logging_out') && !connectionState.qrCodeString && (
                            <Card className={cn(baseCardStyle, "h-60 flex flex-col items-center justify-center p-4")}>
                                <Activity className="h-10 w-10 animate-spin mr-2 text-[#1E90FF] mb-3" style={{ filter: `drop-shadow(0 0 5px ${NEON_COLOR})` }}/>
                                <p className="text-gray-300 text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>{connectionState.message || "Processando..."}</p>
                            </Card>
                        )}
                        {connectionState.status === 'error' && !isProcessingAction && (
                             <Card className={cn(baseCardStyle, "h-60 flex flex-col items-center justify-center text-center p-4")}>
                                <IconWithGlow icon={XCircle} className='h-12 w-12 mb-3' color={NEON_RED}/>
                                <p className="text-red-400 text-sm" style={{ textShadow: `0 0 4px ${NEON_RED}50` }}>Erro na Conexão</p>
                                <p className="text-gray-400 text-xs mt-1" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>{connectionState.message || "Não foi possível conectar ao serviço WhatsApp."}</p>
                                {connectionState.lastError && <p className='text-xs text-red-500 mt-2'>Detalhes: {connectionState.lastError}</p>}
                                <Button onClick={connectWhatsApp} variant="outline" size="sm" className={cn(baseButtonSelectStyle, "mt-4 h-8 px-3 text-xs")} disabled={isProcessingAction}> Tentar Novamente </Button>
                            </Card>
                        )}

                        {connectionState.status === 'connected' && (
                            <div className='space-y-4'>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <ElementCard icon={Check} label="Status da Conexão" value="Conectado" iconColorClass='text-green-400'/>
                                    <ElementCard icon={Users} label="Conversas Ativas (Exemplo)" value={dashboardStatsValues.activeConversations.toString()} />
                                    <ElementCard icon={Activity} label="Última Atividade (Exemplo)" value="Mensagem Recebida" />
                                </div>
                                <Card className={cn(baseCardStyle, "mt-6")}>
                                    <CardHeader><CardTitle className="text-sm font-medium text-white" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>Atividade Recente</CardTitle></CardHeader>
                                    <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Logs de atividade e estatísticas serão exibidos aqui (Funcionalidade futura).</p></CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="contacts" className={cn("flex-grow flex flex-col space-y-3 m-0 p-0 border-none rounded-lg overflow-hidden min-h-0")}>
                        <Card className={cn(baseCardStyle, "flex flex-col h-full")}>
                            <CardHeader className="flex-shrink-0 border-b border-[rgba(${NEON_COLOR_RGB},0.2)] pb-2.5">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>
                                        <IconWithGlow icon={Users} className="mr-2 h-5 w-5"/> Contatos ({filteredContacts.length})
                                    </CardTitle>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={fetchContacts}
                                                disabled={connectionState.status !== 'connected' || isLoadingContacts}
                                                className={cn(baseButtonSelectStyle, "w-8 h-8 rounded")} >
                                                {isLoadingContacts ? <Activity className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className={cn(popoverContentStyle, 'text-xs')}>Atualizar Lista de Contatos</TooltipContent>
                                    </Tooltip>
                                </div>
                                 <div className="relative mt-2.5">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                                    <Input type="search" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded pl-8")} disabled={connectionState.status !== 'connected' && !isLoadingContacts} />
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow p-0 overflow-hidden">
                                <ScrollArea className={cn("h-full", customScrollbarStyle)}>
                                    <div className="p-3 space-y-1.5">
                                        {connectionState.status !== 'connected' ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Conecte o WhatsApp para ver os contatos.</p> )
                                        : isLoadingContacts ? ( <div className='flex justify-center items-center py-10'><Activity className="h-5 w-5 animate-spin mr-2 text-[#1E90FF]" style={{ filter: `drop-shadow(0 0 5px ${NEON_COLOR})` }}/><p className="text-gray-400 text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Carregando contatos...</p></div> )
                                        : contacts.length === 0 && hasAttemptedContactFetch ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Nenhum contato sincronizado.<br/>Tente atualizar ou verifique o log do bot.</p> )
                                        : filteredContacts.length === 0 && searchTerm ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Nenhum contato encontrado para "{searchTerm}".</p> )
                                        : filteredContacts.length === 0 && !hasAttemptedContactFetch && !isLoadingContacts ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Clique em <RefreshCw className="inline h-3 w-3 mx-0.5" /> para carregar os contatos.</p> )
                                        : (
                                            filteredContacts.map(contact => (
                                                <div key={contact.jid} className={cn(baseCardStyle, 'p-2.5 flex items-center space-x-3 hover:bg-[rgba(${NEON_COLOR_RGB},0.1)] transition-colors duration-150 rounded-md cursor-default')}>
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-600">
                                                        {contact.imgUrl ? ( <img src={contact.imgUrl} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.querySelector('svg')?.style.removeProperty('display'); }} onLoad={(e) => {e.currentTarget.style.removeProperty('display'); if(e.currentTarget.parentElement?.querySelector('svg')) {(e.currentTarget.parentElement.querySelector('svg') as SVGElement).style.display = 'none';} }} style={{ display: 'none' }} /> ) : null}
                                                        <UserCircle className="h-5 w-5 text-gray-400" style={{ display: contact.imgUrl ? 'none' : 'block' }}/>
                                                    </div>
                                                    <div className="flex-grow overflow-hidden">
                                                        <p className="text-xs font-medium text-white truncate" title={contact.name || contact.notify || contact.jid.split('@')[0]} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>{contact.name || contact.notify || 'Nome Desconhecido'}</p>
                                                        <p className="text-[10px] text-gray-400" title={contact.jid} style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>{contact.jid.split('@')[0]}</p>
                                                    </div>
                                                     <Tooltip>
                                                         <TooltipTrigger asChild>
                                                             <Button variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-7 h-7 rounded hover:!bg-[rgba(${NEON_COLOR_RGB},0.3)]")} onClick={() => alert(`Iniciar conversa com ${contact.jid} (Funcionalidade futura)`)}>
                                                                 <Send className="h-3.5 w-3.5" />
                                                             </Button>
                                                         </TooltipTrigger>
                                                         <TooltipContent className={cn(popoverContentStyle, 'text-xs')}>Enviar Mensagem</TooltipContent>
                                                     </Tooltip>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="settings" className={cn("flex-grow overflow-y-auto space-y-4 pr-1 min-h-0", customScrollbarStyle)}>
                        <Card className={cn(baseCardStyle)}>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>
                                    <IconWithGlow icon={Settings} className="mr-2 h-5 w-5"/>Configurações Gerais
                                </CardTitle>
                                <CardDescription className="text-xs text-gray-400" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>Ajustes globais do comportamento do bot (Persistência futura).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-3">
                                    <h4 className='text-sm font-medium text-white border-b border-[rgba(${NEON_COLOR_RGB},0.15)] pb-1.5 mb-2.5' style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Comportamento</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 items-center">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-300 flex items-center" htmlFor="defaultDelay" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Clock className="mr-1.5 h-3.5 w-3.5"/> Atraso Padrão (ms)</Label>
                                            <Input id="defaultDelay" type="number" value={settings.defaultMessageDelayMs} onChange={(e) => handleSettingChange('defaultMessageDelayMs', parseInt(e.target.value) || 0)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="Ex: 500" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-300 flex items-center" htmlFor="inputTimeout" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Hourglass className="mr-1.5 h-3.5 w-3.5"/> Timeout Espera Input (s)</Label>
                                            <Input id="inputTimeout" type="number" value={settings.defaultInputTimeoutSeconds} onChange={(e) => handleSettingChange('defaultInputTimeoutSeconds', parseInt(e.target.value) || 0)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="Ex: 60" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-300 flex items-center" htmlFor="unknownResponse" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><HelpCircle className="mr-1.5 h-3.5 w-3.5"/> Msg Desconhecida</Label>
                                            <Select value={settings.unknownMessageResponse} onValueChange={(v: AppSettings['unknownMessageResponse']) => handleSettingChange('unknownMessageResponse', v)}>
                                                <SelectTrigger id="unknownResponse" className={cn(baseButtonSelectStyle, "h-8 text-xs rounded")}> <SelectValue /> </SelectTrigger>
                                                <SelectContent className={cn(popoverContentStyle)}>
                                                    <SelectItem value="ignore" className="text-xs hover:!bg-[rgba(${NEON_COLOR_RGB},0.2)] focus:!bg-[rgba(${NEON_COLOR_RGB},0.2)]">Ignorar</SelectItem>
                                                    <SelectItem value="defaultReply" className="text-xs hover:!bg-[rgba(${NEON_COLOR_RGB},0.2)] focus:!bg-[rgba(${NEON_COLOR_RGB},0.2)]">Resposta Padrão</SelectItem>
                                                    <SelectItem value="forwardAdmin" className="text-xs hover:!bg-[rgba(${NEON_COLOR_RGB},0.2)] focus:!bg-[rgba(${NEON_COLOR_RGB},0.2)]">Encaminhar Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {settings.unknownMessageResponse === 'forwardAdmin' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="adminNumber" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Smartphone className="mr-1.5 h-3.5 w-3.5"/> Nº Admin (JID)</Label>
                                                <Input id="adminNumber" value={settings.adminForwardNumber} onChange={(e) => handleSettingChange('adminForwardNumber', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="5511999998888@s.whatsapp.net" />
                                            </div>
                                        )}
                                    </div>
                                    {settings.unknownMessageResponse === 'defaultReply' && (
                                        <div className="space-y-1 mt-3">
                                            <Label className="text-xs text-gray-300 flex items-center" htmlFor="defaultReplyMsg" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Send className="mr-1.5 h-3.5 w-3.5"/> Mensagem Padrão</Label>
                                            <Textarea id="defaultReplyMsg" value={settings.defaultReplyMessage} onChange={(e) => handleSettingChange('defaultReplyMessage', e.target.value)} className={cn(baseInputInsetStyle, "text-xs rounded min-h-[60px]")} placeholder="Sua mensagem padrão..." rows={2} />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3 pt-4 border-t border-[rgba(${NEON_COLOR_RGB},0.1)]">
                                    <div className='flex justify-between items-center'>
                                        <h4 className='text-sm font-medium text-white' style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Horário Comercial</h4>
                                        <Switch id="enableBusinessHours" checked={settings.enableBusinessHours} onCheckedChange={(checked) => handleSettingChange('enableBusinessHours', checked)} className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600 border-transparent" />
                                    </div>
                                    {settings.enableBusinessHours && (
                                        <div className="space-y-3">
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5 items-center">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-300 flex items-center" htmlFor="bhStart" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Play className="mr-1.5 h-3.5 w-3.5"/> Início (HH:MM)</Label>
                                                    <Input id="bhStart" type="time" value={settings.businessHoursStart} onChange={(e) => handleSettingChange('businessHoursStart', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-300 flex items-center" htmlFor="bhEnd" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Square className="mr-1.5 h-3.5 w-3.5"/> Fim (HH:MM)</Label>
                                                    <Input id="bhEnd" type="time" value={settings.businessHoursEnd} onChange={(e) => handleSettingChange('businessHoursEnd', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} />
                                                </div>
                                             </div>
                                            <div className="space-y-1 mt-3">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="outsideHoursMsg" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Send className="mr-1.5 h-3.5 w-3.5"/> Mensagem Fora do Horário</Label>
                                                <Textarea id="outsideHoursMsg" value={settings.outsideHoursMessage} onChange={(e) => handleSettingChange('outsideHoursMessage', e.target.value)} className={cn(baseInputInsetStyle, "text-xs rounded min-h-[60px]")} placeholder="Sua mensagem fora do horário..." rows={2} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                 <div className="flex justify-end pt-5 border-t border-[rgba(${NEON_COLOR_RGB},0.1)]">
                                     <Button onClick={saveSettings} className={cn(baseButtonSelectStyle, `hover:!bg-[rgba(${NEON_COLOR_RGB},0.3)] h-9 text-sm px-4 rounded`)} disabled={isSavingSettings}>
                                        {isSavingSettings ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {isSavingSettings ? "Salvando..." : "Salvar Configurações"}
                                     </Button>
                                 </div>
                            </CardContent>
                        </Card>
                        <Card className={cn(baseCardStyle)}>
                            <CardHeader><CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}><Bell className="mr-2 h-5 w-5"/> Notificações</CardTitle></CardHeader>
                            <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Configurações de notificação (Funcionalidade futura).</p></CardContent>
                        </Card>
                         <Card className={cn(baseCardStyle)}>
                            <CardHeader><CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}><ShieldCheck className="mr-2 h-5 w-5"/> Segurança & API</CardTitle></CardHeader>
                            <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Configurações de API e segurança (Funcionalidade futura).</p></CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

export default function WhatsAppPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#1a1a1a]">
                <Activity className="h-8 w-8 animate-spin text-[#1E90FF]" style={{ filter: `drop-shadow(0 0 6px ${NEON_COLOR})` }} />
            </div>
        );
    }

    return (
        <LeftSidebarProvider>
            <ReactFlowProvider>
                 <TooltipProvider delayDuration={100}>
                    <WhatsAppDashboard />
                 </TooltipProvider>
            </ReactFlowProvider>
        </LeftSidebarProvider>
    );
}
