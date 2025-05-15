// pages/CopyPage.tsx
import React, { useState, useEffect, ChangeEvent, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import axios, { AxiosError } from 'axios'; // Removido AxiosResponse não utilizado
import { Trash2, Edit, PlusCircle, ClipboardCopy, Loader2, Save, Sparkles, ListChecks, RefreshCw, MessageCircleQuestion } from 'lucide-react'; // Adicionado MessageCircleQuestion
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CampaignOption } from '@/types/chat'; // Mantido se usado, ou pode ser tipo local
// Removido: import { useMCPAgentContext } from '@/context/MCPAgentContext'; // Não mais necessário para esta página
import Image from 'next/image';

interface CopyFormData {
    title: string;
    content: string; 
    caption: string; 
    cta: string;
    target_audience: string;
    status: string;
    campaign_id: string | null;
}
interface Copy {
    id: string;
    title: string;
    content: string; // No DB é content_body
    caption?: string | null; 
    cta: string;
    target_audience?: string | null;
    status?: string | null;
    campaign_id: string | null;
    // No DB são created_at e updated_at. Frontend usa created_date para exibição.
    created_date?: string; 
    updated_at?: string;
    clicks?: number | null;
    impressions?: number | null;
    conversions?: number | null;
    copy_type?: string; // Adicionado para consistência com API
}

// Interface para a resposta da nova API de sugestões
interface CopySuggestionApiResponse {
    suggestions?: string[];
    rawResponse?: string;
    error?: string;
    details?: any;
}


const API_TIMEOUT = 30000; // Para CRUD
const API_SUGGESTION_TIMEOUT = 90000; // Para IA

export default function CopyPage() {
    const { isAuthenticated, isLoading: authLoading, token } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    // Removido: const { isLoading: isUbieLoading } = useMCPAgentContext();

    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [copies, setCopies] = useState<Copy[]>([]);
    const [selectedCopy, setSelectedCopy] = useState<Copy | null>(null);
    const initialFormData: CopyFormData = { title: '', content: '', caption: '', cta: '', target_audience: '', status: 'draft', campaign_id: null, };
    const [formData, setFormData] = useState<CopyFormData>(initialFormData);
    const [isLoadingCrud, setIsLoadingCrud] = useState(false);
    const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
    const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Novos estados para parâmetros de sugestão de IA
    const [suggestionTone, setSuggestionTone] = useState<'persuasive' | 'informative' | 'formal' | 'friendly' | 'humorous'>('persuasive');
    const [suggestionNumVariations, setSuggestionNumVariations] = useState<number>(1);
    const [suggestionCustomInstructions, setSuggestionCustomInstructions] = useState<string>('');
    
    const copyTitleRef = useRef<HTMLInputElement>(null);
    const copyContentRef = useRef<HTMLTextAreaElement>(null);
    const copyCaptionRef = useRef<HTMLTextAreaElement>(null); 
    const copyCtaRef = useRef<HTMLInputElement>(null);

    const neonColor = '#1E90FF';
    const neonColorMuted = '#4682B4';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border border-[hsl(var(--border))]/30";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border border-[hsl(var(--border))]/20 focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9";
    const neumorphicTextAreaStyle = cn(neumorphicInputStyle, "min-h-[80px] py-2");
    const neumorphicButtonStyle = `bg-[#141414] border border-[hsl(var(--border))]/30 text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[hsl(var(--primary))]/10 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out`;
    const primaryButtonStyle = `bg-gradient-to-r from-[hsl(var(--primary))] to-[${neonColorMuted}] hover:from-[${neonColorMuted}] hover:to-[hsl(var(--primary))] text-primary-foreground font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.3)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;
    const statusColors: { [key: string]: string } = { draft: 'bg-gray-600/80 border-gray-500/50 text-gray-200', active: `bg-green-600/80 border-green-500/50 text-green-100 shadow-[0_0_5px_#32CD32]`, paused: 'bg-yellow-600/80 border-yellow-500/50 text-yellow-100', archived: 'bg-slate-700/80 border-slate-600/50 text-slate-300', };
    const getStatusBadgeClass = (status?: string) => cn("text-[10px] uppercase font-medium tracking-wider border px-2 py-0.5 rounded-full shadow-sm", statusColors[status || 'draft'] || statusColors['draft']);

    const loadCampaignOptions = useCallback(async () => {
        // ... (código como na sua última versão, já estava bom) ...
        if (!token) {
            setIsFetchingInitialData(false);
            return;
        }
        setFetchError(null);
        try {
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name', { headers: { Authorization: `Bearer ${token}` }, timeout: API_TIMEOUT });
            if (response.status === 200 && Array.isArray(response.data)) {
                const validOptions = response.data.filter(camp => camp.id != null && camp.name != null);
                setCampaignOptions(validOptions);
                if (validOptions.length > 0 && !formData.campaign_id) {
                    // Não define automaticamente a primeira campanha, deixa o usuário escolher ou "Nenhuma"
                    // setFormData(prev => ({ ...prev, campaign_id: String(validOptions[0].id) }));
                } else if (validOptions.length === 0) {
                    setFormData(prev => ({ ...prev, campaign_id: null }));
                    setCopies([]);
                }
            } else { throw new Error(`Resposta inesperada da API de campanhas: Status ${response.status}`); }
        } catch (err) { const error = err as AxiosError<{ message?: string }>; let errorMsg = "Falha ao carregar lista de campanhas."; if (error.response) { errorMsg = error.response.data?.message || `Erro ${error.response.status}`; } else if (error.request) { errorMsg = "Não foi possível conectar ao servidor."; } else { errorMsg = `Erro: ${error.message}`; } console.error("[CopyPage] Erro loadCampaignOptions:", error); setFetchError(errorMsg); toast({ title: "Erro ao Carregar Campanhas", description: errorMsg, variant: "destructive" }); setCampaignOptions([]); }
        finally {
            setIsFetchingInitialData(false);
        }
    }, [token, toast, formData.campaign_id]);

    const fetchCopiesForCampaign = useCallback(async (campaignId: string | null) => {
        // ... (código como na sua última versão, já estava bom) ...
        if (!campaignId || !token) {
            setCopies([]);
            return;
        }
        setIsLoadingCrud(true);
        setError(null);
        try {
            const response = await axios.get<Copy[]>(`/api/copies?campaign_id=${campaignId}`, { headers: { Authorization: `Bearer ${token}` }, timeout: API_TIMEOUT });
            // A API /api/copies retorna 'content_body', precisamos mapear para 'content' no frontend
            const mappedCopies = response.data.map(copy => ({
                ...copy,
                content: (copy as any).content_body || '' // Mapeia content_body para content
            })) || [];
            setCopies(mappedCopies);
        } catch (err) { const error = err as AxiosError<{ message?: string }>; let errorMsg = "Falha ao buscar cópias."; if (error.response) { errorMsg = error.response.data?.message || `Erro ${error.response.status}`; } else if (error.request) { errorMsg = "Erro de rede."; } else { errorMsg = `Erro: ${error.message}`; } console.error(`[CopyPage] Erro fetchCopies (${campaignId}):`, error); setError(errorMsg); toast({ title: "Erro ao Buscar Cópias", description: errorMsg, variant: "destructive" }); setCopies([]); }
        finally {
            setIsLoadingCrud(false);
        }
    }, [token, toast]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated) {
             setIsFetchingInitialData(true);
             loadCampaignOptions();
        }
    }, [authLoading, isAuthenticated, router, loadCampaignOptions]);

    useEffect(() => {
        if (formData.campaign_id && !isFetchingInitialData) {
            fetchCopiesForCampaign(formData.campaign_id);
        } else if (!formData.campaign_id) {
            setCopies([]);
        }
    }, [formData.campaign_id, isFetchingInitialData, fetchCopiesForCampaign]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSelectChange = (name: keyof CopyFormData) => (value: string) => { setFormData(prev => ({ ...prev, [name]: value })); };
    
    const handleSelectCampaignChange = (value: string) => {
        const selectedId = (value === 'loading' || value === 'no-camps' || value === '') ? null : value;
        setFormData(prev => ({ ...initialFormData, campaign_id: selectedId, target_audience: prev.target_audience })); // Mantém target_audience se já preenchido
        setSelectedCopy(null);
        setError(null);
    };

    const cleanCopySuggestion = (suggestion: string): string => {
        let cleaned = suggestion.trim();
        const commonPrefixes = [
            /^Okay, here'?s a suggestion for the [a-zA-Z\s]+:/i,
            /^Here'?s a suggestion for the [a-zA-Z\s]+:/i,
            /^Here is your [a-zA-Z\s]+:/i,
            /^Here is a [a-zA-Z\s]+:/i,
            /^Sure, here is a [a-zA-Z\s]+:/i,
            /^Okay, here'?s a [a-zA-Z\s]+:/i,
            /^Here are some options for the [a-zA-Z\s]+:/i,
            /^Here is the [a-zA-Z\s]+ copy:/i,
            /^Here's the [a-zA-Z\s]+:/i,
            /^Claro, aqui está uma sugestão de [a-zA-Z\s]+:/i,
            /^Aqui está uma sugestão de [a-zA-Z\s]+:/i,
        ];
        for (const pattern of commonPrefixes) {
            cleaned = cleaned.replace(pattern, "").trim();
        }
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        cleaned = cleaned.replace(/^[-–—*\s\n•]+|[-–—*\s\n•]+$/g, '').trim();
        return cleaned;
    };

    const handleGenerateCopy = async (copyTypeToGenerate: 'title' | 'body' | 'caption' | 'cta_variation') => {
        if (isGeneratingCopy || !token) return;
        
        const payload: any = { // Usando 'any' temporariamente para flexibilidade, idealmente criar interface CopySuggestionRequest
            copyType: copyTypeToGenerate,
            campaignId: formData.campaign_id,
            existingTitle: formData.title,
            existingBody: formData.content,
            existingCaption: formData.caption,
            existingCta: formData.cta,
            targetAudience: formData.target_audience,
            tone: suggestionTone,
            numVariations: suggestionNumVariations,
            customInstructions: suggestionCustomInstructions,
        };

        setIsGeneratingCopy(true); setError(null); toast({ title: "Ubie Pensando...", description: `Gerando ${copyTypeToGenerate}...`, variant: "default" });
        try {
            const response = await axios.post<CopySuggestionApiResponse>('/api/copy-suggestions', payload, { 
                headers: { Authorization: `Bearer ${token}` }, 
                timeout: API_SUGGESTION_TIMEOUT 
            });
            
            if (response.data.suggestions && response.data.suggestions.length > 0) {
                const suggestionToUse = cleanCopySuggestion(response.data.suggestions[0]); // Usar a primeira sugestão por enquanto
                
                if (suggestionToUse) {
                    let fieldToUpdate: keyof CopyFormData = 'content';
                    let refToFocus: React.RefObject<any> = copyContentRef;

                    if (copyTypeToGenerate === 'title') { fieldToUpdate = 'title'; refToFocus = copyTitleRef; }
                    else if (copyTypeToGenerate === 'cta_variation') { fieldToUpdate = 'cta'; refToFocus = copyCtaRef; }
                    else if (copyTypeToGenerate === 'caption') { fieldToUpdate = 'caption'; refToFocus = copyCaptionRef; }
                    else if (copyTypeToGenerate === 'body') { fieldToUpdate = 'content'; refToFocus = copyContentRef; }
                    
                    setFormData(prev => ({ ...prev, [fieldToUpdate]: suggestionToUse }));
                    refToFocus.current?.focus();
                    toast({ title: "Sugestão Gerada!", description: `${copyTypeToGenerate.charAt(0).toUpperCase() + copyTypeToGenerate.slice(1)} preenchido(a).` });
                } else { 
                    toast({ title: "Aviso IA", description: "IA retornou uma sugestão vazia ou não utilizável após processamento.", variant: "default", duration: 5000 });
                }
            } else if (response.data.error) {
                setError(response.data.error); 
                toast({ title: "Erro da IA", description: response.data.error, variant: "destructive" }); 
            } else {
                setError("IA não retornou sugestões válidas."); 
                toast({ title: "Aviso IA", description: "IA não retornou sugestões válidas.", variant: "destructive" }); 
            }
        } catch (error: any) { 
            const errorMsg = error.response?.data?.error || error.message || "Falha ao comunicar com a IA para sugestões."; 
            setError(errorMsg); 
            toast({ title: "Erro ao Gerar Sugestão", description: errorMsg, variant: "destructive" }); 
        }
        finally { setIsGeneratingCopy(false); }
    };

    const handleSaveCopy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.campaign_id) { toast({ title: "Erro", description: "Campanha é obrigatória.", variant: "destructive" }); return; }
        if (!formData.title.trim() || (!formData.content.trim() && !formData.caption.trim()) || !formData.cta.trim()) {
             toast({ title: "Atenção", description: "Preencha Título, CTA e pelo menos Corpo ou Legenda.", variant: "default" }); return;
        }

        setIsLoadingCrud(true); setError(null);
        const url = selectedCopy ? `/api/copies?id=${selectedCopy.id}` : '/api/copies';
        const method = selectedCopy ? 'PUT' : 'POST';
        try {
            // Mapear formData.content para content_body para a API
            const payload = { 
                ...formData, 
                content_body: formData.content, // Mapeamento
                campaign_id: String(formData.campaign_id) 
            };
            // Remover 'content' do payload se não for um campo esperado pela API para criar/atualizar
            // delete (payload as any).content; // Removido para manter, API /api/copies pode ignorar campos extras

            await axios({ method, url, data: payload, headers: { Authorization: `Bearer ${token}` }, timeout: API_TIMEOUT });
            toast({ title: "Sucesso!", description: `Cópia ${selectedCopy ? 'atualizada' : 'criada'} com sucesso.` });
            resetFormFields(formData.campaign_id);
            if (formData.campaign_id) fetchCopiesForCampaign(formData.campaign_id);
        } catch (err) { const error = err as AxiosError<{ message?: string }>; let errorMsg = `Falha ao ${selectedCopy ? 'atualizar' : 'criar'} cópia.`; if (error.response) { errorMsg = error.response.data?.message || `Erro ${error.response.status}`; } else if (error.request) { errorMsg = "Erro de rede."; } else { errorMsg = `Erro: ${error.message}`; } setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" }); }
        finally { setIsLoadingCrud(false); }
    };

    const handleSelectCopy = (copy: Copy) => {
        setSelectedCopy(copy);
        setFormData({
            title: copy.title || '',
            content: copy.content || '', // Frontend usa 'content'
            caption: copy.caption || '', 
            cta: copy.cta || '',
            target_audience: copy.target_audience || '',
            status: copy.status || 'draft',
            campaign_id: String(copy.campaign_id) || null
        });
        setError(null);
        copyTitleRef.current?.focus();
    };

    const handleDeleteCopy = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta cópia?')) return;
        setIsLoadingCrud(true); setError(null);
        try {
            await axios.delete(`/api/copies?id=${id}`, { headers: { Authorization: `Bearer ${token}` }, timeout: API_TIMEOUT });
            toast({ title: "Sucesso", description: "Cópia excluída." });
            if (selectedCopy?.id === id) { resetFormFields(formData.campaign_id); }
            if (formData.campaign_id) fetchCopiesForCampaign(formData.campaign_id);
        } catch (err) { const error = err as AxiosError<{ message?: string }>; let errorMsg = "Falha ao excluir cópia."; if (error.response) { errorMsg = error.response.data?.message || `Erro ${error.response.status}`; } else if (error.request) { errorMsg = "Erro de rede."; } else { errorMsg = `Erro: ${error.message}`; } setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" }); }
        finally { setIsLoadingCrud(false); }
    };

    const resetFormFields = (campaignIdToKeep: string | null = null) => {
        setFormData({ ...initialFormData, campaign_id: campaignIdToKeep }); 
        setSelectedCopy(null);
        setError(null);
    };
    
    const copyToClipboard = (text: string | undefined | null) => {
        if (text) {
            navigator.clipboard.writeText(text)
                .then(() => toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência." }))
                .catch(err => toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" }));
        }
    };

    if (authLoading || isFetchingInitialData) {
        return <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">{authLoading ? 'Verificando...' : 'Carregando dados iniciais...'}</span></div></Layout>;
    }
    if (!isAuthenticated) return null; 
    if (fetchError) { return ( <Layout> <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center text-center text-red-400 p-6"> <div> <h2 className="text-lg font-semibold mb-2">Erro ao Carregar Dados da Página</h2> <p className="text-sm">{fetchError}</p> <Button onClick={() => { setFetchError(null); setIsFetchingInitialData(true); loadCampaignOptions(); }} className={cn(primaryButtonStyle, 'mt-4')}> <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> </div> </div> </Layout> ); }

    return (
        <Layout>
            <Head><title>Planejamento de Copy - USBMKT</title></Head>
            <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
                 <div className="flex-shrink-0"><h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}> Planejamento de Copy </h1></div>
                 <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
                     <div className="lg:col-span-2 space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
                         <Card className={cn(cardStyle)}>
                             <CardHeader><CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}>{selectedCopy ? <Edit size={16} className="mr-2" /> : <PlusCircle size={16} className="mr-2" />} {selectedCopy ? 'Editar Cópia' : 'Nova Cópia'}</CardTitle></CardHeader>
                             <CardContent>
                                {error && !isLoadingCrud && !isGeneratingCopy && (<p className={cn("text-xs mb-3 p-2 rounded border text-center", `bg-red-900/30 border-red-700/50 text-red-300`)}>{error}</p>)}
                                <form onSubmit={handleSaveCopy} className="space-y-3">
                                    <div className="space-y-1"> <Label htmlFor="campaign_id" className="text-xs text-gray-400">Campanha*</Label> <Select value={formData.campaign_id || ''} onValueChange={handleSelectCampaignChange} required disabled={isLoadingCrud || isGeneratingCopy || isFetchingInitialData}> <SelectTrigger id="campaign_id" className={cn(neumorphicInputStyle, "w-full h-9 text-sm")}> <SelectValue placeholder={isFetchingInitialData ? "Carregando campanhas..." : (campaignOptions.length === 0 ? "Nenhuma campanha encontrada" : "Selecione...")} /> </SelectTrigger> <SelectContent className="bg-[#1a1c23] border-[#2d62a3]/50 text-white"> {isFetchingInitialData && <SelectItem value="loading" disabled>Carregando...</SelectItem>} {!isFetchingInitialData && campaignOptions.length === 0 && <SelectItem value="no-camps" disabled>Nenhuma campanha</SelectItem>} {campaignOptions.map((camp) => ( <SelectItem key={camp.id} value={String(camp.id)} className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer"> {camp.name} </SelectItem> ))} </SelectContent> </Select> </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1 md:col-span-2"> <Label htmlFor="title" className="text-xs text-gray-400">Título*</Label> <Input ref={copyTitleRef} id="title" name="title" value={formData.title} onChange={handleInputChange} required className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoadingCrud || isGeneratingCopy}/> </div>
                                        <div className="space-y-1 md:col-span-2"> <Label htmlFor="content" className="text-xs text-gray-400">Corpo do Anúncio</Label> <Textarea ref={copyContentRef} id="content" name="content" value={formData.content} onChange={handleInputChange} className={cn(neumorphicTextAreaStyle, "min-h-[150px] text-sm")} disabled={isLoadingCrud || isGeneratingCopy}/> </div>
                                        <div className="space-y-1 md:col-span-2"> <Label htmlFor="caption" className="text-xs text-gray-400">Legenda (Redes Sociais)</Label> <Textarea ref={copyCaptionRef} id="caption" name="caption" value={formData.caption} onChange={handleInputChange} className={cn(neumorphicTextAreaStyle, "min-h-[100px] text-sm")} disabled={isLoadingCrud || isGeneratingCopy}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="cta" className="text-xs text-gray-400">CTA*</Label> <Input ref={copyCtaRef} id="cta" name="cta" value={formData.cta} onChange={handleInputChange} required className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoadingCrud || isGeneratingCopy}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="target_audience" className="text-xs text-gray-400">Público-Alvo</Label> <Input id="target_audience" name="target_audience" value={formData.target_audience} onChange={handleInputChange} className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoadingCrud || isGeneratingCopy}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="status" className="text-xs text-gray-400">Status</Label> <Select value={formData.status} onValueChange={handleSelectChange('status')} disabled={isLoadingCrud || isGeneratingCopy} > <SelectTrigger id="status" className={cn(neumorphicInputStyle, "w-full h-9 text-sm")}> <SelectValue /> </SelectTrigger> <SelectContent className="bg-[#1a1c23] border-[#2d62a3]/50 text-white"> <SelectItem value="draft" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Rascunho</SelectItem> <SelectItem value="active" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Ativa</SelectItem> <SelectItem value="paused" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Pausada</SelectItem> <SelectItem value="archived" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Arquivada</SelectItem> </SelectContent> </Select> </div>
                                     </div>
                                    <div className="flex justify-end gap-2 pt-3"> <Button type="button" variant="outline" onClick={() => resetFormFields(formData.campaign_id)} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} disabled={isLoadingCrud || isGeneratingCopy}> Limpar </Button> <Button type="submit" disabled={isLoadingCrud || isGeneratingCopy || isFetchingInitialData || !formData.campaign_id || !formData.title.trim() || (!formData.content.trim() && !formData.caption.trim()) || !formData.cta.trim()} className={cn(primaryButtonStyle, "h-8 px-3 text-xs")} > {isLoadingCrud ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Save className="h-4 w-4 mr-1" />} {isLoadingCrud ? 'Salvando...' : (selectedCopy ? 'Salvar' : 'Criar')} </Button> </div>
                                </form>
                            </CardContent>
                        </Card>
                         <Card className={cn(cardStyle)}>
                             <CardHeader> <CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> <Image src="/character.png" alt="Ubie Icon" width={18} height={18} className="mr-2 rounded-full" style={{ filter: `drop-shadow(0 0 3px ${neonColorMuted})` }}/> Ubie Copywriter (Nova API) </CardTitle> </CardHeader>
                             <CardContent className="space-y-4">
                                <p className="text-xs text-gray-400">Use a IA para gerar sugestões de copy. Preencha os campos do formulário acima para dar contexto à IA.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1"> <Label htmlFor="suggestionTone" className="text-xs text-gray-400">Tom da Sugestão</Label> <Select value={suggestionTone} onValueChange={(val) => setSuggestionTone(val as any)} disabled={isGeneratingCopy}> <SelectTrigger id="suggestionTone" className={cn(neumorphicInputStyle, "h-9 text-sm")}> <SelectValue /> </SelectTrigger> <SelectContent className="bg-[#1a1c23] border-[#2d62a3]/50 text-white"> <SelectItem value="persuasive" className="text-xs">Persuasivo</SelectItem> <SelectItem value="informative" className="text-xs">Informativo</SelectItem> <SelectItem value="formal" className="text-xs">Formal</SelectItem> <SelectItem value="friendly" className="text-xs">Amigável</SelectItem> <SelectItem value="humorous" className="text-xs">Humorístico</SelectItem> </SelectContent> </Select> </div>
                                    <div className="space-y-1"> <Label htmlFor="suggestionNumVariations" className="text-xs text-gray-400">Nº de Variações</Label> <Input type="number" id="suggestionNumVariations" value={suggestionNumVariations} onChange={(e) => setSuggestionNumVariations(Math.max(1, parseInt(e.target.value,10) || 1))} min="1" max="5" className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isGeneratingCopy} /> </div>
                                </div>
                                <div className="space-y-1"> <Label htmlFor="suggestionCustomInstructions" className="text-xs text-gray-400">Instruções Adicionais (Opcional)</Label> <Textarea id="suggestionCustomInstructions" value={suggestionCustomInstructions} onChange={(e) => setSuggestionCustomInstructions(e.target.value)} placeholder="Ex: Focar nos benefícios X e Y. Usar gatilho de urgência." className={cn(neumorphicTextAreaStyle, "min-h-[60px] text-sm")} disabled={isGeneratingCopy} /> </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                     <Button size="sm" onClick={() => handleGenerateCopy('body')} disabled={isGeneratingCopy || !formData.campaign_id || isLoadingCrud || isFetchingInitialData} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} > {isGeneratingCopy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Gerar Corpo </Button>
                                     <Button size="sm" onClick={() => handleGenerateCopy('title')} disabled={isGeneratingCopy || !formData.campaign_id || isLoadingCrud || isFetchingInitialData} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} > {isGeneratingCopy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Gerar Títulos </Button>
                                     <Button size="sm" onClick={() => handleGenerateCopy('caption')} disabled={isGeneratingCopy || !formData.campaign_id || isLoadingCrud || isFetchingInitialData} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} > {isGeneratingCopy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Gerar Legenda </Button>
                                     <Button size="sm" onClick={() => handleGenerateCopy('cta_variation')} disabled={isGeneratingCopy || !formData.campaign_id || !formData.cta || isLoadingCrud || isFetchingInitialData} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} > {isGeneratingCopy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Variar CTA </Button>
                                </div>
                             </CardContent>
                        </Card>
                     </div>
                     <div className="lg:col-span-1">
                        <Card className={cn(cardStyle, "h-full flex flex-col")}>
                           <CardHeader className="flex-shrink-0 p-4 border-b border-[hsl(var(--border))]/30"> <CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> <ListChecks size={16} className="mr-2" /> Cópias Salvas </CardTitle> </CardHeader>
                           <CardContent className="flex-grow p-0 overflow-hidden">
                               <ScrollArea className="h-full px-4 py-2">
                                    {(isLoadingCrud && copies.length === 0) ? ( <div className="flex justify-center items-center h-40"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> </div> )
                                    : (!formData.campaign_id && !isFetchingInitialData) ? ( <p className="text-center text-gray-400 p-6 text-xs">Selecione uma campanha para ver as cópias.</p> )
                                    : (copies.length === 0 && !isLoadingCrud) ? ( <p className="text-center text-gray-400 p-6 text-xs">Nenhuma cópia para esta campanha.</p> )
                                    : ( <div className="space-y-2"> {copies.map((copy) => ( <Card key={copy.id} className={cn("cursor-pointer transition-all duration-150 ease-out", "bg-[#181a1f]/70 border border-[hsl(var(--border))]/20", "hover:bg-[#1E90FF]/10 hover:border-[hsl(var(--primary))]/40", selectedCopy?.id === copy.id && "ring-1 ring-[hsl(var(--primary))] bg-[#1E90FF]/15 border-[hsl(var(--primary))]/50" )} onClick={() => handleSelectCopy(copy)}> <CardContent className="p-2 space-y-1"> <div className="flex justify-between items-start gap-2"> <p className="text-xs font-semibold text-white truncate flex-1 pr-1" title={copy.title}>{copy.title}</p> <div className="flex gap-1 flex-shrink-0"> <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 hover:text-white p-0.5" onClick={(e) => { e.stopPropagation(); copyToClipboard(copy.content || copy.caption); }} title="Copiar Texto Principal"><ClipboardCopy size={11} /></Button> <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-400 hover:bg-red-900/30 p-0.5" onClick={(e) => { e.stopPropagation(); handleDeleteCopy(copy.id); }} title="Excluir Cópia" disabled={isLoadingCrud}><Trash2 size={11}/></Button> </div> </div> <p className="text-[11px] text-gray-400 line-clamp-2" title={copy.content || copy.caption}>{copy.content || copy.caption || 'Sem corpo/legenda.'}</p> <div className="flex justify-between items-center pt-1 gap-2"> <Badge className={getStatusBadgeClass(copy.status)}>{copy.status || 'draft'}</Badge> <p className="text-[10px] text-gray-500 truncate" title={`CTA: ${copy.cta}`}>CTA: {copy.cta || 'N/A'}</p> </div> </CardContent> </Card> ))} </div> )}
                               </ScrollArea>
                           </CardContent>
                       </Card>
                    </div>
                 </div>
            </div>
        </Layout>
    );
}
