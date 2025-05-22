// pages/campaign-manager.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Search, ChevronUp, ChevronDown, Filter as FilterIcon, Loader2 } from 'lucide-react'; // Renomeado Filter para FilterIcon
import CampaignManagerForm, { CampaignFormData, ClientAccountOption } from '@/components/CampaignManagerForm'; // CampaignFormData vem daqui
import { useAuth } from '@/context/AuthContext';
import axios from 'axios'; // Usando axios global
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CampaignStatus } from '@/entities/Campaign'; // Supondo que você tem este tipo

// Tipo para os dados da API de campanhas (o que vem DENTRO de response.data.data[])
// Deve estar alinhado com o que deserializeCampaign na API retorna
interface CampaignApiResponseData {
  id: string;
  name: string;
  status: CampaignStatus | string; // Use o tipo específico se tiver
  selectedClientAccountId?: string | null;
  // Campos retornados pela API (camelCase)
  platforms?: string[] | null;
  objective?: string[] | null;
  adFormat?: string[] | null; // Nome que a API retorna para o frontend
  budget?: number;
  daily_budget?: number; // Se API retorna snake_case, deserializeCampaign deve converter para dailyBudget
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null;   // YYYY-MM-DD
  targetAudienceDescription?: string | null;
  industry?: string | null;
  segmentationNotes?: string | null;
  avgTicket?: number;
  externalCampaignId?: string | null;
  platformSource?: string | null;
  externalPlatformAccountId?: string | null;
  client_name?: string | null; // Nome do cliente (texto)
  product_name?: string | null; // Nome do produto (texto)
  // Adicione outros campos conforme a API retorna
  cost_traffic?: number;
  cost_creative?: number;
  cost_operational?: number;
  purchaseFrequency?: number;
  customerLifespan?: number;
  duration?: number;
}

// Tipo para a lista exibida na tabela do frontend
interface CampaignListItem {
  id: string;
  name: string;
  clientName: string; // Nome da conta do cliente (para exibição)
  platformDisplay: string; // String formatada para exibição
  objectiveDisplay: string; // String formatada para exibição
  statusDisplay: string; // String formatada para exibição
  dailyBudgetDisplay: string; // String formatada para exibição
}

interface FullCampaignsApiResponse {
  data: CampaignApiResponseData[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  };
}

const statusDisplayMap: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  archived: "Arquivada",
};


const CampaignManagerPage: React.FC = () => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [availableClientAccounts, setAvailableClientAccounts] = useState<ClientAccountOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaignData, setEditingCampaignData] = useState<CampaignFormData | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClientAccount, setFilterClientAccount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name'); // Coluna do DB, ex: 'name', 'created_at'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchClientAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get<ClientAccountOption[]>(`${API_URL}/api/client-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(response.data)) {
        setAvailableClientAccounts(response.data);
      } else {
        setAvailableClientAccounts([]);
      }
    } catch (error) {
      console.error('Erro ao carregar contas de cliente:', error);
      setAvailableClientAccounts([]);
    }
  }, [token, API_URL]);

  const fetchData = useCallback(async () => {
    if (!token) { setIsLoadingData(false); return; }

    setIsLoadingData(true);
    try {
      const response = await axios.get<FullCampaignsApiResponse>(`${API_URL}/api/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortBy, // API espera nome da coluna do DB
          sortOrder: sortOrder,
          search: searchTerm,
          status: filterStatus,
          selectedClientAccountId: filterClientAccount,
        },
      });

      if (response.data && Array.isArray(response.data.data) && response.data.pagination) {
        const mappedCampaigns: CampaignListItem[] = response.data.data.map((campaign: CampaignApiResponseData) => {
          const clientAccount = availableClientAccounts.find(acc => acc.id === campaign.selectedClientAccountId);
          const clientName = clientAccount ? clientAccount.name : (campaign.client_name || 'N/A');
          
          return {
            id: campaign.id,
            name: campaign.name,
            clientName: clientName,
            platformDisplay: Array.isArray(campaign.platforms) ? campaign.platforms.join(', ') : 'N/A',
            objectiveDisplay: Array.isArray(campaign.objective) ? campaign.objective.join(', ') : 'N/A',
            statusDisplay: statusDisplayMap[campaign.status] || campaign.status,
            dailyBudgetDisplay: campaign.daily_budget ? `R$ ${Number(campaign.daily_budget).toFixed(2)}` : 'N/A',
          };
        });
        setCampaigns(mappedCampaigns);
        setTotalItems(response.data.pagination.totalItems || 0);
        setTotalPages(response.data.pagination.totalPages || 0);
        setCurrentPage(response.data.pagination.currentPage || 1);
      } else {
        setCampaigns([]); setTotalItems(0); setTotalPages(0);
      }
    } catch (error) {
      console.error('Erro ao buscar dados das campanhas:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar as campanhas.', variant: 'destructive' });
      setCampaigns([]); setTotalItems(0); setTotalPages(0);
    } finally {
      setIsLoadingData(false);
    }
  }, [token, currentPage, itemsPerPage, sortBy, sortOrder, searchTerm, filterStatus, filterClientAccount, availableClientAccounts, toast, API_URL]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && token) { fetchClientAccounts(); }
  }, [authLoading, isAuthenticated, token, fetchClientAccounts]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && token) {
        // Não depender de availableClientAccounts.length > 0 para o primeiro fetch,
        // pois pode não haver contas ou o filtro de conta não estar aplicado.
        fetchData();
    }
  }, [authLoading, isAuthenticated, token, fetchData]);


  const handleOpenForm = (campaignListItem?: CampaignListItem) => {
    if (campaignListItem) {
      const fetchFullCampaignData = async () => {
        if (!token) { toast({ title: 'Erro de Autenticação', variant: 'destructive' }); return; }
        try {
          // API GET por ID retorna um único objeto CampaignApiResponseData
          const response = await axios.get<CampaignApiResponseData>(`${API_URL}/api/campaigns?id=${campaignListItem.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.data) {
            // Mapear para CampaignFormData (camelCase se necessário, e Date objects para datas)
            // A interface CampaignFormData em CampaignManagerForm.tsx DEVE ter estes campos.
            setEditingCampaignData({
              id: response.data.id,
              name: response.data.name,
              status: response.data.status, 
              selectedClientAccountId: response.data.selectedClientAccountId,
              platforms: response.data.platforms || [],
              objective: response.data.objective || [],
              ad_format: response.data.adFormat || [], // Assumindo que API retorna adFormat (camelCase)
              budget: response.data.budget,
              daily_budget: response.data.daily_budget, // Assumindo que API retorna daily_budget (snake_case) ou dailyBudget (camelCase)
              start_date: response.data.start_date ? new Date(response.data.start_date + "T00:00:00Z") : undefined, // Adicionar Z para UTC
              end_date: response.data.end_date ? new Date(response.data.end_date + "T00:00:00Z") : undefined,
              target_audience_description: response.data.targetAudienceDescription, // API retorna targetAudienceDescription
              industry: response.data.industry,
              segmentation_notes: response.data.segmentationNotes, // API retorna segmentationNotes
              avg_ticket: response.data.avgTicket,                 // API retorna avgTicket
              external_campaign_id: response.data.externalCampaignId,
              platform_source: response.data.platformSource,
              external_platform_account_id: response.data.externalPlatformAccountId,
              client_name: response.data.client_name,
              product_name: response.data.product_name,
              cost_traffic: response.data.cost_traffic,
              cost_creative: response.data.cost_creative,
              cost_operational: response.data.cost_operational,
              purchaseFrequency: response.data.purchaseFrequency,
              customerLifespan: response.data.customerLifespan,
              duration: response.data.duration
            });
            setIsFormOpen(true);
          }
        } catch (error) { /* ... toast ... */ }
      };
      fetchFullCampaignData();
    } else {
      setEditingCampaignData(null); 
      setIsFormOpen(true);
    }
  };

  const handleCloseForm = () => { setIsFormOpen(false); setEditingCampaignData(null); };

  const handleSaveCampaign = async (formDataToSave: CampaignFormData) => {
    if (!token) { toast({ title: 'Erro de Autenticação', variant: 'destructive' }); return; }
    // A API /api/campaigns espera os nomes de campo conforme CampaignFormData da API (geralmente camelCase)
    // e a API faz o mapeamento para snake_case do DB.
    // Os campos Date já devem ser string YYYY-MM-DD ou null se o DatePicker os retorna assim.
    // Se DatePicker retorna Date objects, converta-os para string YYYY-MM-DD aqui.
    const payload = {
        ...formDataToSave,
        start_date: formDataToSave.start_date instanceof Date ? formDataToSave.start_date.toISOString().split('T')[0] : formDataToSave.start_date,
        end_date: formDataToSave.end_date instanceof Date ? formDataToSave.end_date.toISOString().split('T')[0] : formDataToSave.end_date,
    };

    try {
      if (payload.id) {
        await axios.put(`${API_URL}/api/campaigns?id=${payload.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: 'Sucesso', description: 'Campanha atualizada.' });
      } else {
        await axios.post(`${API_URL}/api/campaigns`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: 'Sucesso', description: 'Campanha criada.' });
      }
      handleCloseForm();
      fetchData(); 
    } catch (error: any) { /* ... toast ... */ }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!token) { toast({ title: 'Erro de Autenticação', variant: 'destructive' }); return; }
    if (window.confirm('Excluir esta campanha?')) {
      try {
        await axios.delete(`${API_URL}/api/campaigns?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: 'Sucesso', description: 'Campanha excluída.' });
        fetchData(); 
      } catch (error: any) { /* ... toast ... */ }
    }
  };

  const handleSort = (columnDbName: string) => {
    if (sortBy === columnDbName) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnDbName);
      setSortOrder('asc'); // Ou 'desc' como padrão para novas colunas
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) { setCurrentPage(page); }
  };

  if (authLoading || (!isAuthenticated && !authLoading)) { /* ... loading ... */ }

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-50">Gestão de Tráfego</h1>
          <Button onClick={() => handleOpenForm()} className="bg-sky-600 hover:bg-sky-700 text-white">
            <PlusCircle className="mr-2 h-5 w-5" /> Adicionar Campanha
          </Button>
        </div>

        <Card className="mb-6 bg-slate-800/50 border-slate-700 text-slate-100">
          <CardHeader><CardTitle className="text-lg font-semibold">Filtros</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputStyle} />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={inputStyle}><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-slate-100">
                <SelectItem value="">Todos Status</SelectItem>
                {statusDisplayMap && Object.entries(statusDisplayMap).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClientAccount} onValueChange={setFilterClientAccount}>
              <SelectTrigger className={inputStyle}><SelectValue placeholder="Conta de Cliente" /></SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-slate-100">
                <SelectItem value="">Todas Contas</SelectItem>
                {availableClientAccounts.map((account) => (<SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => {setCurrentPage(1); fetchData();}} className={cn(buttonStyle, "md:col-start-4")}>
              <FilterIcon className="mr-2 h-4 w-4" /> Aplicar
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 text-slate-100">
          <CardHeader><CardTitle className="text-lg font-semibold">Lista de Campanhas</CardTitle></CardHeader>
          <CardContent>
            {isLoadingData && campaigns.length === 0 ? (
              <div className="flex justify-center items-center h-48 text-slate-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...</div>
            ) : !isLoadingData && campaigns.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Nenhuma campanha encontrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-slate-700 hover:bg-slate-700/30">
                      {/* Adapte os cabeçalhos e handleSort para usar nomes de coluna do DB */}
                      <TableHead onClick={() => handleSort('name')} className="cursor-pointer">Nome {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} className="inline"/> : <ChevronDown size={14} className="inline"/>)}</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plataforma(s)</TableHead>
                      <TableHead>Objetivo(s)</TableHead>
                      <TableHead onClick={() => handleSort('status')} className="cursor-pointer">Status {sortBy === 'status' && (sortOrder === 'asc' ? <ChevronUp size={14} className="inline"/> : <ChevronDown size={14} className="inline"/>)}</TableHead>
                      <TableHead className="text-right">Orçamento Diário</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} className="border-b-slate-700 hover:bg-slate-700/30">
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.clientName}</TableCell>
                        <TableCell>{campaign.platformDisplay}</TableCell>
                        <TableCell>{campaign.objectiveDisplay}</TableCell>
                        <TableCell>{campaign.statusDisplay}</TableCell>
                        <TableCell className="text-right">{campaign.dailyBudgetDisplay}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-700"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-700 border-slate-600 text-slate-100">
                              <DropdownMenuItem onClick={() => handleOpenForm(campaign)} className="hover:bg-slate-600 focus:bg-slate-600">Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id)} className="text-red-400 hover:bg-red-500/20 focus:bg-red-500/20">Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center p-4 border-t border-slate-700">
            <div className="text-sm text-slate-400">Mostrando {campaigns.length} de {totalItems}</div>
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || totalPages === 0} /></PaginationItem>
                {[...Array(totalPages)].map((_, index) => (
                  <PaginationItem key={index}><PaginationLink onClick={() => handlePageChange(index + 1)} isActive={currentPage === index + 1}>{index + 1}</PaginationLink></PaginationItem>
                ))}
                <PaginationItem><PaginationNext onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>

        <CampaignManagerForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveCampaign}
          campaignData={editingCampaignData} // CampaignFormData
          availableClientAccounts={availableClientAccounts} // ClientAccountOption[]
        />
      </div>
    </Layout>
  );
};

export default CampaignManagerPage;
