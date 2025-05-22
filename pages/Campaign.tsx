// pages/Campaign.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Campaign as CampaignEntity } from '@/entities/Campaign'; // Interface da API/Entidade
import axios from 'axios'; // Usar axios para consistência, ou seu axiosInstance
import { Trash2, Edit, PlusCircle, Loader2, ChevronUp, ChevronDown, ListFilter, Search, ArrowUpDown } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { MultiSelectPopover, Option } from "@/components/ui/multi-select-popover"; // Assumindo que Option é exportado
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker'; // Assumindo que você tem este componente

// --- Interfaces, Constantes ---
// FormDataState para o formulário, usando nomes que o frontend manipula (geralmente camelCase)
interface FormDataState {
    name: string;
    client_name?: string | null;
    product_name?: string | null;
    industry?: string | null;
    targetAudience?: string | null; // Será mapeado para target_audience na API
    platforms: string[];           // Será mapeado para platform (JSON) na API
    objective: string[];           // Será mapeado para objective (JSON) na API
    budget: string;
    daily_budget: string;
    segmentation?: string | null;   // Será mapeado para segmentation na API
    adFormat: string[];            // Será mapeado para ad_format (JSON) na API
    duration: string;
    cost_traffic: string;
    cost_creative: string;
    cost_operational: string;
    status?: CampaignEntity['status'];
    startDate?: string | null;      // YYYY-MM-DD
    endDate?: string | null;        // YYYY-MM-DD
    avgTicket?: string;             // Será mapeado para avg_ticket
    purchaseFrequency?: string;     // Será mapeado para purchase_frequency
    customerLifespan?: string;      // Será mapeado para customer_lifespan
    selected_client_account_id?: string | null; // Para vincular a contas de cliente (se aplicável)
    // Campos que a API espera (já snake_case, se CampaignFormData da API for assim)
    // Ou campos que o frontend usa e a API mapeia. Vamos manter camelCase aqui e deixar a API mapear.
}

const initialFormData: FormDataState = {
    name: '', client_name: '', product_name: '', industry: '', targetAudience: '', platforms: [], objective: [],
    budget: '0', daily_budget: '0', segmentation: '', adFormat: [], duration: '0',
    cost_traffic: '0', cost_creative: '0', cost_operational: '0',
    status: 'draft', startDate: null, endDate: null,
    avgTicket: '0', purchaseFrequency: '0', customerLifespan: '0',
    selected_client_account_id: null,
};

// Interface para a resposta da API de listagem
interface CampaignsApiResponse {
    data: CampaignEntity[];
    pagination: {
        totalItems: number;
        totalPages: number;
        currentPage: number;
        itemsPerPage: number;
    };
}

const platformOptions: Option[] = [ { value: "google_ads", label: "Google Ads" }, { value: "meta_ads", label: "Meta Ads" }, { value: "tiktok_ads", label: "TikTok Ads" }, { value: "linkedin_ads", label: "LinkedIn Ads" }, { value: "other", label: "Outra" }, ];
const objectiveOptions: Option[] = [ { value: "conversao", label: "Conversão" }, { value: "leads", label: "Leads" }, { value: "trafego", label: "Tráfego" }, { value: "reconhecimento", label: "Reconhecimento" }, { value: "vendas_catalogo", label: "Vendas Catálogo" }, ];
const adFormatOptions: Option[] = [ { value: "imagem", label: "Imagem" }, { value: "video", label: "Vídeo" }, { value: "carrossel", label: "Carrossel" }, { value: "colecao", label: "Coleção" }, { value: "search", label: "Search" }, { value: "display", label: "Display" }, ];
const statusOptions: { value: CampaignEntity['status']; label: string }[] = [
    { value: "draft", label: "Rascunho" }, { value: "active", label: "Ativa" },
    { value: "paused", label: "Pausada" }, { value: "completed", label: "Concluída" },
    { value: "archived", label: "Arquivada" },
];

const neonColor = '#1E90FF';
const cardStyle = "bg-slate-800/60 backdrop-blur-sm shadow-xl rounded-lg border border-slate-700";
const inputStyle = "bg-slate-700/50 border-slate-600 text-slate-50 placeholder:text-slate-400 focus:ring-sky-500 focus:border-sky-500";
const labelStyle = "text-xs font-medium text-slate-300 mb-1";
const buttonStyle = "bg-sky-600 hover:bg-sky-700 text-white";
const outlineButtonStyle = "border-slate-600 hover:bg-slate-700 text-slate-300";

export default function CampaignPage() {
  const { isAuthenticated, isLoading: authLoading, userId, token } = useAuth(); // Adicionado token e userId
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignEntity[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignEntity | null>(null);
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const ITEMS_PER_PAGE = 10;

  const fetchCampaigns = useCallback(async () => {
    if (!isAuthenticated || !token) {
        setIsLoadingData(false);
        return;
    }
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          sortBy: sortBy,
          sortOrder: sortOrder,
      });
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('status', filterStatus);
      // if (userId) params.append('user_id', String(userId)); // A API deve filtrar por user_id com base no token

      console.log(`[CampaignPage] Fetching: /api/campaigns?${params.toString()}`);
      const response = await axios.get<CampaignsApiResponse>(`/api/campaigns?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      
      if (response.data && Array.isArray(response.data.data)) {
        setCampaigns(response.data.data); 
        setTotalItems(response.data.pagination.totalItems || 0);
        setTotalPages(response.data.pagination.totalPages || 1); // Evitar 0 para não desabilitar botões indevidamente
        setCurrentPage(response.data.pagination.currentPage || 1);
      } else {
        console.warn("[CampaignPage] Resposta da API não continha 'data' como array:", response.data);
        setCampaigns([]); setTotalItems(0); setTotalPages(1);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Falha ao buscar campanhas.";
      toast({ title: "Erro ao Buscar Campanhas", description: errorMsg, variant: "destructive" });
      setCampaigns([]); setTotalItems(0); setTotalPages(1);
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, token, toast, currentPage, searchTerm, filterStatus, sortBy, sortOrder, userId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
        router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
        fetchCampaigns();
    }
  }, [isAuthenticated, token, fetchCampaigns]); // fetchCampaigns é dependência

   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
     const { name, value } = e.target;
     setFormData((prev) => ({ ...prev, [name]: value }));
   };

   const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const { name, value } = e.target;
     const regex = /^-?\d*\.?\d*$/;
     if (value === '' || value === '-' || regex.test(value)) {
       setFormData((prev) => ({ ...prev, [name]: value }));
     }
   };

   const handleMultiSelectChange = (name: keyof Pick<FormDataState, 'platforms' | 'objective' | 'adFormat'>) => (selectedValues: string[]) => {
     setFormData((prev) => ({ ...prev, [name]: selectedValues }));
   };
   
   const handleStatusChange = (value: string) => {
     setFormData(prev => ({...prev, status: value as CampaignEntity['status']}))
   };

   const handleDateChange = (name: 'startDate' | 'endDate', date: Date | undefined) => {
    setFormData(prev => ({ ...prev, [name]: date ? date.toISOString().split('T')[0] : null }));
   };

   const handleStepChange = (name: keyof Pick<FormDataState, 'budget' | 'daily_budget' | 'duration' | 'cost_traffic' | 'cost_creative' | 'cost_operational' | 'avgTicket' | 'purchaseFrequency' | 'customerLifespan'>, direction: 'up' | 'down') => {
     setFormData((prev) => {
       const currentValue = parseFloat(String(prev[name] || '0').replace(',','.'));
       let step = 10;
       if (name === 'duration' || name === 'customerLifespan') step = 1;
       else if (name === 'purchaseFrequency') step = 0.1;
       const precision = (name === 'duration' || name === 'customerLifespan') ? 0 : (name === 'purchaseFrequency' ? 1: 2);
       let newValue = direction === 'up' ? currentValue + step : currentValue - step;
       newValue = Math.max(0, newValue);
       return { ...prev, [name]: newValue.toFixed(precision) };
     });
   };
   
   const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    if (!formData.name?.trim()) {
        toast({ title: "Erro de Validação", description: "Nome da campanha é obrigatório.", variant: "destructive" });
        setIsSaving(false);
        return;
    }
    
    const campaignPayload: Partial<CampaignFormData> = { // API espera CampaignFormData, mas aqui montamos o payload
        name: formData.name.trim(),
        // user_id será adicionado pela API com base no token
        client_name: formData.client_name || undefined,
        product_name: formData.product_name || undefined,
        industry: formData.industry || undefined,
        targetAudience: formData.targetAudience || undefined,
        platforms: formData.platforms && formData.platforms.length > 0 ? formData.platforms : undefined,
        objective: formData.objective && formData.objective.length > 0 ? formData.objective : undefined,
        budget: formData.budget && formData.budget !== '0' ? parseFloat(String(formData.budget).replace(',', '.')) : undefined,
        daily_budget: formData.daily_budget && formData.daily_budget !== '0' ? parseFloat(String(formData.daily_budget).replace(',', '.')) : undefined,
        segmentation: formData.segmentation || undefined,
        adFormat: formData.adFormat && formData.adFormat.length > 0 ? formData.adFormat : undefined,
        duration: formData.duration && formData.duration !== '0' ? parseInt(String(formData.duration).replace(/\D/g,''), 10) : undefined,
        cost_traffic: formData.cost_traffic && formData.cost_traffic !== '0' ? parseFloat(String(formData.cost_traffic).replace(',', '.')) : undefined,
        cost_creative: formData.cost_creative && formData.cost_creative !== '0' ? parseFloat(String(formData.cost_creative).replace(',', '.')) : undefined,
        cost_operational: formData.cost_operational && formData.cost_operational !== '0' ? parseFloat(String(formData.cost_operational).replace(',', '.')) : undefined,
        status: formData.status || 'draft',
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        avgTicket: formData.avgTicket && formData.avgTicket !== '0' ? parseFloat(String(formData.avgTicket).replace(',', '.')) : undefined,
        purchaseFrequency: formData.purchaseFrequency && formData.purchaseFrequency !== '0' ? parseFloat(String(formData.purchaseFrequency).replace(',', '.')) : undefined,
        customerLifespan: formData.customerLifespan && formData.customerLifespan !== '0' ? parseInt(String(formData.customerLifespan).replace(/\D/g,''), 10) : undefined,
        selected_client_account_id: formData.selected_client_account_id || undefined,
    };
    
    // Remover chaves com valor undefined para não enviar campos vazios desnecessariamente
    Object.keys(campaignPayload).forEach(keyStr => {
        const key = keyStr as keyof typeof campaignPayload;
        if (campaignPayload[key] === undefined) {
            delete campaignPayload[key];
        }
    });

    console.log('[handleSave] Enviando Payload para API:', JSON.stringify(campaignPayload, null, 2));

    try {
        let response;
        if (selectedCampaign?.id) {
            response = await axios.put(`/api/campaigns?id=${selectedCampaign.id}`, campaignPayload, { headers: { Authorization: `Bearer ${token}` } });
            toast({ title: "Campanha Atualizada" });
        } else {
            response = await axios.post('/api/campaigns', campaignPayload, { headers: { Authorization: `Bearer ${token}` } });
            toast({ title: "Campanha Criada" });
        }
        console.log("[handleSave] Sucesso da API:", response.status, response.data);
        setIsFormModalOpen(false);
        fetchCampaigns(); 
    } catch (error: any) {
        console.error("[handleSave] ERRO Axios:", error.response?.data || error.message || error);
        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Falha ao salvar campanha.";
        toast({ title: "Erro ao Salvar", description: errorMsg, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
   };

   const openFormModal = (campaign: CampaignEntity | null = null) => {
        if (campaign) {
            setSelectedCampaign(campaign);
            // A API deve retornar campos JSON como arrays e datas como YYYY-MM-DD
            setFormData({
                name: campaign.name || '',
                client_name: (campaign as any).client_name || '',
                product_name: (campaign as any).product_name || '',
                industry: campaign.industry || '',
                targetAudience: campaign.targetAudience || '', // API deve retornar 'targetAudience'
                platforms: Array.isArray(campaign.platforms) ? campaign.platforms : [], // API deve retornar 'platforms'
                objective: Array.isArray(campaign.objective) ? campaign.objective : [],
                budget: campaign.budget?.toString() ?? '0',
                daily_budget: campaign.daily_budget?.toString() ?? '0',
                segmentation: campaign.segmentation || '',
                adFormat: Array.isArray(campaign.adFormat) ? campaign.adFormat : [], // API deve retornar 'adFormat'
                duration: campaign.duration?.toString() ?? '0',
                cost_traffic: campaign.cost_traffic?.toString() ?? '0',
                cost_creative: campaign.cost_creative?.toString() ?? '0',
                cost_operational: campaign.cost_operational?.toString() ?? '0',
                status: campaign.status ?? 'draft',
                startDate: campaign.startDate ? campaign.startDate.split('T')[0] : null,
                endDate: campaign.endDate ? campaign.endDate.split('T')[0] : null,
                avgTicket: campaign.avgTicket?.toString() ?? '0',
                purchaseFrequency: campaign.purchaseFrequency?.toString() ?? '0',
                customerLifespan: campaign.customerLifespan?.toString() ?? '0',
                selected_client_account_id: (campaign as any).selected_client_account_id || null,
            });
        } else {
            setSelectedCampaign(null);
            setFormData(initialFormData);
        }
        setIsFormModalOpen(true);
    };

   const handleDelete = async (id: string | number) => {
        if (!confirm(`Tem certeza que deseja excluir a campanha ID ${id}?`)) return;
        setIsSaving(true);
        try {
            await axios.delete(`/api/campaigns?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast({ title: "Campanha Excluída" });
            if (selectedCampaign?.id === id) {
                setIsFormModalOpen(false);
            }
            fetchCampaigns();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || "Falha ao excluir campanha.";
            toast({ title: "Erro ao Excluir", description: errorMsg, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSort = (columnKey: string) => {
        if (sortBy === columnKey) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(columnKey);
            setSortOrder('desc');
        }
        setCurrentPage(1); // Reset page on sort
    };

    const SortIndicator = ({ columnKey }: { columnKey: string }) => {
        if (sortBy !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
        return sortOrder === 'desc' ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronUp className="ml-2 h-4 w-4" />;
    };


  if (authLoading && !isAuthenticated) { 
      return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /><span className="ml-2 text-slate-400">Verificando autenticação...</span></div></Layout> );
  }
  // Não renderiza nada se não autenticado e o redirect do useEffect ainda não ocorreu
  if (!isAuthenticated) return null; 

  return (
    <Layout>
      <Head><title>Campanhas - USBMKT</title></Head>
      <div className="container mx-auto p-4 md:p-6 space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">Gerenciador de Campanhas</h1>
            <Button onClick={() => openFormModal(null)} className={cn(buttonStyle, "flex-shrink-0")}>
                <PlusCircle size={18} className="mr-2"/> Adicionar Campanha
            </Button>
        </div>

        {/* Filtros */}
        <Card className={cardStyle}>
            <CardContent className="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="lg:col-span-2">
                    <Label htmlFor="searchCampaign" className={labelStyle}>Buscar Campanha</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            id="searchCampaign"
                            type="text"
                            placeholder="Nome da campanha..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1);}}
                            className={cn(inputStyle, "pl-8")}
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="filterStatus" className={labelStyle}>Status</Label>
                    <Select value={filterStatus} onValueChange={(value) => { setFilterStatus(value === 'all' ? '' : value); setCurrentPage(1);}}>
                        <SelectTrigger id="filterStatus" className={cn(inputStyle)}>
                            <SelectValue placeholder="Todos Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 text-slate-100">
                            <SelectItem value="all" className="hover:bg-slate-600">Todos Status</SelectItem>
                            {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value || ''} className="hover:bg-slate-600">{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => fetchCampaigns()} className={cn(outlineButtonStyle, "w-full sm:w-auto self-end h-9")} disabled={isLoadingData}>
                    {isLoadingData ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <ListFilter size={16} className="mr-2"/>}
                    Aplicar Filtros
                </Button>
            </CardContent>
        </Card>

        {/* Tabela de Campanhas */}
        {isLoadingData && campaigns.length === 0 && (
            <div className="flex-grow flex items-center justify-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500 mr-3" /> Carregando campanhas...
            </div>
        )}
        {!isLoadingData && campaigns.length === 0 && (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-400 p-10 bg-slate-800/30 rounded-lg">
                <Search size={48} className="opacity-30 mb-4"/>
                <p className="text-lg font-semibold text-slate-300">Nenhuma campanha encontrada.</p>
                <p className="text-sm">
                    {searchTerm || filterStatus ? "Tente ajustar seus filtros ou " : "Crie uma nova campanha para começar."}
                    {(searchTerm || filterStatus) && 
                        <Button variant="link" className="p-0 h-auto text-sky-500 hover:text-sky-400" onClick={() => { setSearchTerm(''); setFilterStatus(''); setCurrentPage(1); }}>
                            limpar filtros.
                        </Button>
                    }
                </p>
            </div>
        )}

        {!isLoadingData && campaigns.length > 0 && (
            <Card className={cn(cardStyle, "flex-grow flex flex-col min-h-0")}> {/* min-h-0 para ScrollArea funcionar bem em flex col */}
                <ScrollArea className="flex-grow">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-700 hover:bg-slate-700/50">
                                {[{key:'name', label:'Nome'}, {key:'status', label:'Status'}, {key:'budget', label:'Orçamento'}, {key:'daily_budget', label:'Diário'}, {key:'start_date', label:'Início'}, {key:'created_at', label:'Criação'}].map(col => (
                                    <TableHead key={col.key} className="text-slate-300 cursor-pointer hover:text-sky-400" onClick={() => handleSort(col.key)}>
                                        {col.label} <SortIndicator columnKey={col.key} />
                                    </TableHead>
                                ))}
                                <TableHead className="text-slate-300 text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-slate-400">
                            {campaigns.map((campaign) => (
                            <TableRow key={campaign.id} className="border-slate-700 hover:bg-slate-700/30">
                                <TableCell className="font-medium text-slate-200">{campaign.name}</TableCell>
                                <TableCell><span className={`px-2 py-0.5 text-xs rounded-full ${campaign.status === 'active' ? 'bg-green-500/20 text-green-400' : campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-600 text-slate-300'}`}>{statusOptions.find(s=>s.value === campaign.status)?.label || campaign.status}</span></TableCell>
                                <TableCell>R$ {Number(campaign.budget || 0).toFixed(2)}</TableCell>
                                <TableCell>R$ {Number(campaign.daily_budget || 0).toFixed(2)}</TableCell>
                                <TableCell>{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'N/A'}</TableCell>
                                <TableCell>{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-sky-400 hover:text-sky-300" onClick={() => openFormModal(campaign)}><Edit size={14}/></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400" onClick={() => handleDelete(campaign.id)}><Trash2 size={14}/></Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <CardFooter className="p-3 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <p className="text-xs text-slate-400">
                        Página {currentPage} de {totalPages}. Total: {totalItems} campanhas.
                    </p>
                    <div className="flex space-x-1.5">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || isLoadingData} className={cn(outlineButtonStyle, "h-7 px-2.5 text-xs")}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || isLoadingData || totalPages === 0} className={cn(outlineButtonStyle, "h-7 px-2.5 text-xs")}>Próxima</Button>
                    </div>
                </CardFooter>
            </Card>
        )}

        {/* Formulário Modal */}
        <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
            <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 sm:max-w-[600px] md:max-w-[750px] lg:max-w-[900px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sky-400">{selectedCampaign ? `Editando Campanha: ${selectedCampaign.name}` : 'Criar Nova Campanha'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-2 -mr-3"> {/* Padding para compensar scrollbar */}
                <form onSubmit={handleSave} className="space-y-4 p-1"> {/* onSubmit aqui, mas o botão de submit está no DialogFooter */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2"> <Label htmlFor="formName" className={labelStyle}>Nome da Campanha*</Label> <Input id="formName" name="name" value={formData.name} onChange={handleInputChange} required className={inputStyle} /> </div>
                        <div> <Label htmlFor="formClientName" className={labelStyle}>Nome do Cliente</Label> <Input id="formClientName" name="client_name" value={formData.client_name || ''} onChange={handleInputChange} className={inputStyle} /> </div>
                        <div> <Label htmlFor="formProductName" className={labelStyle}>Nome do Produto/Serviço</Label> <Input id="formProductName" name="product_name" value={formData.product_name || ''} onChange={handleInputChange} className={inputStyle} /> </div>
                        <div> <Label htmlFor="formIndustry" className={labelStyle}>Indústria</Label> <Input id="formIndustry" name="industry" value={formData.industry || ''} onChange={handleInputChange} className={inputStyle} /> </div>
                        <div> <Label htmlFor="formSegmentation" className={labelStyle}>Segmentação Principal</Label> <Input id="formSegmentation" name="segmentation" value={formData.segmentation || ''} onChange={handleInputChange} className={inputStyle} /> </div>
                        <div className="md:col-span-2"> <Label htmlFor="formTargetAudience" className={labelStyle}>Descrição do Público-Alvo</Label> <Textarea id="formTargetAudience" name="targetAudience" value={formData.targetAudience || ''} onChange={handleInputChange} className={cn(inputStyle, "min-h-[70px]")} /> </div>
                        
                        <div> <Label className={labelStyle}>Plataformas</Label> <MultiSelectPopover options={platformOptions} value={formData.platforms} onChange={handleMultiSelectChange('platforms')} placeholder="Selecione..." triggerClassName={cn(inputStyle, "h-9")} /> </div>
                        <div> <Label className={labelStyle}>Objetivos</Label> <MultiSelectPopover options={objectiveOptions} value={formData.objective} onChange={handleMultiSelectChange('objective')} placeholder="Selecione..." triggerClassName={cn(inputStyle, "h-9")} /> </div>
                        <div> <Label className={labelStyle}>Formatos de Anúncio</Label> <MultiSelectPopover options={adFormatOptions} value={formData.adFormat} onChange={handleMultiSelectChange('adFormat')} placeholder="Selecione..." triggerClassName={cn(inputStyle, "h-9")} /> </div>
                        
                        <div> <Label htmlFor="formStatus" className={labelStyle}>Status</Label>
                            <Select value={formData.status || 'draft'} onValueChange={handleStatusChange}>
                                <SelectTrigger id="formStatus" className={cn(inputStyle)}><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-700 border-slate-600 text-slate-100">{statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value || ''} className="hover:bg-slate-600">{opt.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div> <Label htmlFor="formStartDate" className={labelStyle}>Data de Início</Label> <DatePicker date={formData.startDate ? new Date(formData.startDate + "T00:00:00") : undefined} setDate={(date) => handleDateChange('startDate', date)} triggerClassName={inputStyle} /> </div>
                        <div> <Label htmlFor="formEndDate" className={labelStyle}>Data de Término</Label> <DatePicker date={formData.endDate ? new Date(formData.endDate + "T00:00:00") : undefined} setDate={(date) => handleDateChange('endDate', date)} triggerClassName={inputStyle} /> </div>
                        
                        <div className="md:col-span-2 text-sm font-medium text-sky-400 pt-2 mt-2 border-t border-slate-700">Orçamentos e Custos</div>
                        <div> <Label htmlFor="formBudget" className={labelStyle}>Orçamento Total (R$)</Label> <Input id="formBudget" name="budget" type="text" inputMode='decimal' value={formData.budget} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formDailyBudget" className={labelStyle}>Orçamento Diário (R$)</Label> <Input id="formDailyBudget" name="daily_budget" type="text" inputMode='decimal' value={formData.daily_budget} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formDuration" className={labelStyle}>Duração (Dias)</Label> <Input id="formDuration" name="duration" type="text" inputMode='numeric' value={formData.duration} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formCostTraffic" className={labelStyle}>Custo Tráfego (R$)</Label> <Input id="formCostTraffic" name="cost_traffic" type="text" inputMode='decimal' value={formData.cost_traffic} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formCostCreative" className={labelStyle}>Custo Criativos (R$)</Label> <Input id="formCostCreative" name="cost_creative" type="text" inputMode='decimal' value={formData.cost_creative} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formCostOperational" className={labelStyle}>Custo Operacional (R$)</Label> <Input id="formCostOperational" name="cost_operational" type="text" inputMode='decimal' value={formData.cost_operational} onChange={handleNumberInputChange} className={inputStyle}/> </div>

                        <div className="md:col-span-2 text-sm font-medium text-sky-400 pt-2 mt-2 border-t border-slate-700">Métricas de Negócio (Opcional)</div>
                        <div> <Label htmlFor="formAvgTicket" className={labelStyle}>Ticket Médio (R$)</Label> <Input id="formAvgTicket" name="avgTicket" type="text" inputMode='decimal' value={formData.avgTicket} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formPurchaseFrequency" className={labelStyle}>Frequência de Compra (por ano)</Label> <Input id="formPurchaseFrequency" name="purchaseFrequency" type="text" inputMode='decimal' value={formData.purchaseFrequency} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        <div> <Label htmlFor="formCustomerLifespan" className={labelStyle}>Tempo de Vida do Cliente (anos)</Label> <Input id="formCustomerLifespan" name="customerLifespan" type="text" inputMode='numeric' value={formData.customerLifespan} onChange={handleNumberInputChange} className={inputStyle}/> </div>
                        {/* Adicionar selected_client_account_id se for relevante neste formulário */}
                    </div>
                </form>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t border-slate-700">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className={outlineButtonStyle}>Cancelar</Button>
                    </DialogClose>
                    <Button type="button" onClick={() => handleSave()} disabled={isSaving} className={buttonStyle}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                        {isSaving ? 'Salvando...' : (selectedCampaign ? 'Salvar Alterações' : 'Criar Campanha')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
