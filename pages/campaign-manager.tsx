// pages/campaign-manager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Mantido para filtros
import { useToast } from '@/components/ui/use-toast';
import { cn } from "@/lib/utils";
import { PlusCircle, ListFilter, Search, Edit, Trash2, MoreHorizontal, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
// import CampaignManagerForm, { CampaignFormData, ClientAccountOption } from '@/components/CampaignManagerForm'; // Comentado temporariamente
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Comentado temporariamente
// import { Badge } from "@/components/ui/badge"; // Comentado temporariamente
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu'; // Comentado temporariamente
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { format as formatDateFns, parseISO, isValid as isValidDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Manter interfaces para estrutura de dados, mesmo que o form e tabela estejam comentados
export interface ClientAccountOption { // Exportar se usado por CampaignManagerForm quando descomentado
    id: string;
    name: string;
    platform: 'google' | 'meta' | 'tiktok' | 'manual' | string;
    platformAccountId: string;
  }
  
export interface CampaignFormData { // Exportar se usado por CampaignManagerForm quando descomentado
    id?: string | null;
    name: string;
    status: string;
    selectedClientAccountId?: string | null;
    platform: string[];
    objective: string[];
    ad_format: string[];
    budget?: number | string | null;
    daily_budget?: number | string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    target_audience_description?: string | null;
    industry?: string | null;
    segmentation_notes?: string | null;
    avg_ticket?: number | string | null;
    external_campaign_id?: string | null;
}

interface CampaignListItem extends CampaignFormData {
  id: string;
  clientAccountName?: string;
  platformText?: string;
  objectiveText?: string;
}

interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

const STATUS_OPTIONS_FILTER = [
    { value: 'all', label: 'Todos Status' },
    { value: 'draft', label: 'Rascunho' },
    { value: 'active', label: 'Ativa' },
    { value: 'paused', label: 'Pausada' },
    { value: 'completed', label: 'Concluída' },
    { value: 'archived', label: 'Arquivada' }
];

// formatDate e formatCurrency podem ser removidos se não usados na renderização simplificada
// const formatDate = (dateInput: Date | string | null | undefined): string => { /* ... */ };
// const formatCurrency = (value?: number | string | null): string => { /* ... */ };

export default function CampaignManagerPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<CampaignFormData> | null>(null);
  
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [availableClientAccounts, setAvailableClientAccounts] = useState<ClientAccountOption[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClientAccount, setFilterClientAccount] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const neonColor = '#1E90FF';
  const primaryButtonStyle = `bg-gradient-to-r from-[${neonColor}] to-[#4682B4] hover:from-[#4682B4] hover:to-[${neonColor}] text-white font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)]`;
  const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
  const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9";
  // const tableHeaderStyle = "text-xs font-semibold text-gray-400 uppercase tracking-wider"; // Não usado se tabela comentada
  // const tableCellStyle = "text-sm text-gray-200 py-2.5"; // Não usado
  // const statusBadgeColors: { [key: string]: string } = { /* ... */ }; // Não usado
  const selectContentStyle = "bg-[#1e2128] border-[#1E90FF]/30 text-white";


  const fetchClientAccounts = useCallback(async () => {
    console.log("[ClientAccounts] Fetching... Token:", token ? 'present' : 'absent');
    if (!token) return;
    try {
      const response = await axios.get<ClientAccountOption[]>('/api/client-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[ClientAccounts] API Response:', response); 
      console.log('[ClientAccounts] response.data:', response.data); 
      console.log('[ClientAccounts] Is response.data an array?:', Array.isArray(response.data)); 
      setAvailableClientAccounts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao buscar contas de clientes:", error);
      toast({ title: "Erro", description: "Falha ao carregar contas de clientes.", variant: "destructive" });
      setAvailableClientAccounts([]);
    }
  }, [token, toast]);

  const fetchData = useCallback(async () => {
    console.log("[Campaigns] FetchData called. Token:", token ? 'present' : 'absent');
    if (!token) {
      setIsLoadingData(false);
      console.log("[Campaigns] No token, aborting fetchData.");
      return;
    }
    setIsLoadingData(true);
    
    let currentClientAccounts = availableClientAccounts;
    if (currentClientAccounts.length === 0 && token) {
        console.log("[Campaigns] availableClientAccounts is empty, attempting to fetch them within fetchData.");
        try {
            const clientAccountsResponse = await axios.get<ClientAccountOption[]>('/api/client-accounts', { headers: { Authorization: `Bearer ${token}` }});
            console.log('[Campaigns] Inner fetchClientAccounts Response.data:', clientAccountsResponse.data); 
            currentClientAccounts = Array.isArray(clientAccountsResponse.data) ? clientAccountsResponse.data : [];
            if(availableClientAccounts.length === 0 && currentClientAccounts.length > 0) {
                 setAvailableClientAccounts(currentClientAccounts);
            }
        } catch (error) {
            console.error("Erro ao buscar contas de clientes dentro de fetchData:", error);
            currentClientAccounts = [];
        }
    }
    console.log("[Campaigns] Using client accounts for mapping (before API call):", currentClientAccounts, Array.isArray(currentClientAccounts));

    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterClientAccount !== 'all') params.append('selectedClientAccountId', filterClientAccount);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      console.log(`[Campaigns] Fetching /api/campaigns with params: ${params.toString()}`);
      const response = await axios.get<PaginatedApiResponse<CampaignFormData>>(`/api/campaigns?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('[Campaigns] API /api/campaigns Full Response:', response); 
      console.log('[Campaigns] API /api/campaigns response.data:', response.data); 
      
      if (response.data && response.data.pagination && Array.isArray(response.data.data)) {
        console.log('[Campaigns] response.data.data IS an array. Length:', response.data.data.length); 
        const campaignsFromApi = response.data.data;
        
        const finalClientAccountsForMap = Array.isArray(currentClientAccounts) ? currentClientAccounts : [];

        const mappedCampaigns = campaignsFromApi.map(c => {
          // console.log('[Campaigns Map] Processing campaign object c:', c); 
          if (!c || typeof c.id === 'undefined') { 
              console.error('[Campaigns Map] Invalid campaign object:', c);
              return null; 
          }
          return {
            ...c,
            id: c.id!,
            clientAccountName: finalClientAccountsForMap.find(acc => acc.id === c.selectedClientAccountId)?.name || 'N/A',
            platformText: Array.isArray(c.platform) ? c.platform.join(', ') : (typeof c.platform === 'string' ? c.platform : 'N/A'),
            objectiveText: Array.isArray(c.objective) ? c.objective.join(', ') : (typeof c.objective === 'string' ? c.objective : 'N/A'),
          };
        }).filter(item => item !== null); // Filtra os nulos explicitamente
        setCampaigns(mappedCampaigns as CampaignListItem[]); // Cast após filtrar nulos
        setTotalItems(response.data.pagination.totalItems);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        console.error('[Campaigns] Estrutura inesperada da API /api/campaigns ou response.data.data não é array:', response.data);
        setCampaigns([]); setTotalItems(0); setTotalPages(0);
      }
    } catch (error: any) {
      console.error("Erro ao buscar dados das campanhas:", error.response?.data || error.message);
      toast({ title: "Erro de Carregamento", description: "Falha ao carregar campanhas.", variant: "destructive" });
      setCampaigns([]); setTotalItems(0); setTotalPages(0);
    } finally {
      setIsLoadingData(false);
      console.log("[Campaigns] FetchData finished.");
    }
  }, [token, toast, filterStatus, filterClientAccount, searchTerm, currentPage, itemsPerPage, sortBy, sortOrder, availableClientAccounts]);


  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && token) {
      fetchClientAccounts(); 
    }
  }, [authLoading, isAuthenticated, router, token, fetchClientAccounts]);

  useEffect(() => {
    if (token) { 
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [currentPage, filterStatus, filterClientAccount, sortBy, sortOrder, searchTerm, token]);


  const handleOpenForm = (campaign?: CampaignListItem) => { // campaign é CampaignListItem
    const formDataForEdit = campaign ? { 
        ...campaign, // Spread de CampaignListItem
        start_date: campaign.start_date ? new Date(campaign.start_date) : null,
        end_date: campaign.end_date ? new Date(campaign.end_date) : null,
        // Remover campos que não existem em CampaignFormData se necessário, mas a interface permite opcionais
     } : null;
    setEditingCampaign(formDataForEdit as Partial<CampaignFormData> | null); // Cast para o tipo esperado
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  const handleSaveCampaign = async (formData: Partial<CampaignFormData>) => {
    if (!token) {
        toast({ title: "Erro de Autenticação", variant: "destructive" });
        return;
    }
    const method = formData.id ? 'PUT' : 'POST';
    const url = formData.id ? `/api/campaigns?id=${formData.id}` : '/api/campaigns';
    try {
      await axios({ method, url, data: formData, headers: { Authorization: `Bearer ${token}` } });
      toast({ title: "Sucesso", description: `Campanha ${formData.id ? `"${formData.name}" atualizada` : `"${formData.name}" criada`}!` });
      if (method === 'POST') setCurrentPage(1); 
      fetchData(); 
    } catch (error: any) {
      toast({ title: "Erro ao Salvar", description: error.response?.data?.message || error.message || "Falha.", variant: "destructive" });
    }
    handleCloseForm();
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName?: string) => {
    if (!token) {
        toast({ title: "Erro de Autenticação", variant: "destructive" });
        return;
    }
    if (!confirm(`Tem certeza que deseja excluir a campanha "${campaignName || campaignId}"?`)) return;
    
    try {
        await axios.delete(`/api/campaigns?id=${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: "Excluído", description: `Campanha "${campaignName || campaignId}" foi excluída.`, variant: "destructive" });
        if (campaigns.length === 1 && currentPage > 1 && totalItems > 1) { 
            setCurrentPage(currentPage - 1);
        } else {
            fetchData();
        }
    } catch (error: any) {
        toast({ title: "Erro ao Excluir", description: error.response?.data?.message || error.message || "Falha.", variant: "destructive" });
    }
  };

  const handleSort = (columnKey: string) => { /* ... (como antes) ... */ };
  const renderSortIcon = (columnKey: string) => { /* ... (como antes) ... */ };

  console.log('[Render Init] availableClientAccounts:', availableClientAccounts, Array.isArray(availableClientAccounts));
  console.log('[Render Init] campaigns:', campaigns, Array.isArray(campaigns));

  if (authLoading && !token) return <Layout><div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  if (!isAuthenticated && !authLoading) return null; 

  return (
    <Layout>
      <Head><title>Gestão de Tráfego - USBMKT</title></Head>
      <div className="space-y-5 p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>
            Gestão de Tráfego
          </h1>
          <Button className={cn(primaryButtonStyle, "h-9 text-sm")} onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Campanha
          </Button>
        </div>

        <Card className={cn(cardStyle, "p-3")}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2 lg:col-span-2">
              <Label htmlFor="searchCampaign" className="text-xs text-gray-300 mb-1 block">Buscar Campanha</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                    id="searchCampaign" 
                    placeholder="Nome, cliente, plataforma, objetivo..." 
                    className={cn(neumorphicInputStyle, "pl-8 h-8 text-xs")} 
                    value={searchTerm}
                    onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
                />
              </div>
            </div>
            <div>
                <Label htmlFor="filterStatus" className="text-xs text-gray-300 mb-1 block">Status</Label>
                <Select value={filterStatus} onValueChange={(value) => {setFilterStatus(value); setCurrentPage(1);}}>
                    <SelectTrigger id="filterStatus" className={cn(neumorphicInputStyle, "h-8 text-xs")}><SelectValue /></SelectTrigger>
                    <SelectContent className={selectContentStyle}>
                        {STATUS_OPTIONS_FILTER.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="filterClientAccount" className="text-xs text-gray-300 mb-1 block">Conta de Cliente</Label>
                <Select value={filterClientAccount} onValueChange={(value) => {setFilterClientAccount(value); setCurrentPage(1);}} disabled={!Array.isArray(availableClientAccounts) || availableClientAccounts.length === 0 && !isLoadingData}>
                    <SelectTrigger id="filterClientAccount" className={cn(neumorphicInputStyle, "h-8 text-xs")}><SelectValue placeholder={isLoadingData && (!Array.isArray(availableClientAccounts) || availableClientAccounts.length === 0) ? "Carregando..." : "Selecione..."} /></SelectTrigger>
                    <SelectContent className={selectContentStyle}>
                        <SelectItem value="all">Todas as Contas</SelectItem>
                        {Array.isArray(availableClientAccounts) && availableClientAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.platform.toUpperCase()})</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </Card>

        <Card className={cn(cardStyle)}>
          <CardHeader className="px-4 py-3 border-b border-[#1E90FF]/10">
            <CardTitle className="text-base font-semibold text-white">Lista de Campanhas ({totalItems})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingData && !authLoading ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-gray-400">Carregando dados...</span></div>
            ) : (
              <div className="p-4 text-white">
                <p>Teste: Tabela de campanhas seria renderizada aqui.</p>
                <p>Estado de `campaigns` é array? {Array.isArray(campaigns) ? 'Sim' : 'Não'}</p>
                <p>Número de campanhas no estado: {Array.isArray(campaigns) ? campaigns.length : 'N/A'}</p>
                {Array.isArray(campaigns) && campaigns.length > 0 ? 
                    campaigns.map(c => <div key={c.id}>{c.name}</div>) : 
                    <p>Nenhuma campanha para exibir na lista simplificada.</p>
                }
              </div>
            )}
          </CardContent>
           {/* PAGINAÇÃO TEMPORARIAMENTE SIMPLIFICADA */}
           {totalPages > 0 && (
            <CardFooter className="py-3 px-4 border-t border-[#1E90FF]/10 flex items-center justify-end space-x-2">
                <span className="text-xs text-gray-400">Pág {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage === 1 || isLoadingData}>Ant</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage === totalPages || isLoadingData}>Próx</Button>
            </CardFooter>
           )}
        </Card>
      </div>

      {/* FORMULÁRIO TEMPORARIAMENTE COMENTADO PARA ISOLAR O ERRO .map */}
      {/* {isFormOpen && (
         <CampaignManagerForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveCampaign}
          campaignData={editingCampaign}
          availableClientAccounts={availableClientAccounts} // Garanta que isso seja sempre um array
         />
      )} */}
    </Layout>
  );
}
