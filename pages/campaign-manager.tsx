// pages/campaign-manager.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import CampaignManagerForm, { CampaignFormData, ClientAccountOption } from '@/components/CampaignManagerForm';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
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


// Tipos para os dados da API de campanhas
interface CampaignResponse {
  id: string;
  name: string;
  status: string;
  selectedClientAccountId: string;
  selectedClientAccountName?: string; // Adicionado para exibição no frontend
  platform: string[];
  objective: string[];
  ad_format: string[];
  daily_budget: number;
  budget: number;
  start_date: string;
  end_date: string;
  target_audience_description: string;
  industry: string;
  segmentation_notes: string;
  avg_ticket: number;
  external_campaign_id: string;
  platform_source: string;
  external_platform_account_id: string;
  client_name?: string; // Para a tabela, se vier do DB
  product_name?: string; // Para a tabela, se vier do DB
}

interface CampaignListItem {
  id: string;
  name: string;
  clientName: string; // Nome da conta do cliente
  platform: string; // Ex: Google Ads, Meta Ads
  objective: string; // Ex: Vendas, Leads
  status: string;
  dailyBudget: number;
}

interface CampaignApiResponse {
  data: CampaignResponse[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  };
}

const CampaignManagerPage: React.FC = () => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [availableClientAccounts, setAvailableClientAccounts] = useState<ClientAccountOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaignData, setEditingCampaignData] = useState<CampaignFormData | null>(null);

  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClientAccount, setFilterClientAccount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Pode ser ajustado ou selecionável
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Função para buscar contas de clientes
  const fetchClientAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get<ClientAccountOption[]>(`${API_URL}/api/client-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[CampaignManager] Contas de cliente carregadas:', response.data); // Log para inspecionar
      // **VERIFICAÇÃO CRÍTICA AQUI**
      if (Array.isArray(response.data)) {
        setAvailableClientAccounts(response.data);
      } else {
        console.error('[CampaignManager] Resposta inesperada para client-accounts:', response.data);
        setAvailableClientAccounts([]); // Garante que seja um array
      }
    } catch (error) {
      console.error('Erro ao carregar contas de cliente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as contas de cliente.',
        variant: 'destructive',
      });
      setAvailableClientAccounts([]); // Garante que seja um array em caso de erro
    }
  }, [token, toast, API_URL]);

  // Função para buscar dados das campanhas
  const fetchData = useCallback(async () => {
    if (!token) return;

    setIsLoadingData(true);
    try {
      const response = await axios.get<CampaignApiResponse>(`${API_URL}/api/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortBy,
          sortOrder: sortOrder,
          search: searchTerm,
          status: filterStatus,
          selectedClientAccountId: filterClientAccount,
        },
      });

      console.log('[CampaignManager] Resposta da API /api/campaigns:', response.data); // Log para inspecionar

      // **VERIFICAÇÃO CRÍTICA AQUI**
      if (response.data && Array.isArray(response.data.data)) {
        const mappedCampaigns: CampaignListItem[] = response.data.data.map((campaign: CampaignResponse) => {
          // Encontrar o nome da conta do cliente correspondente
          const clientAccount = availableClientAccounts.find(acc => acc.id === campaign.selectedClientAccountId);
          const clientName = clientAccount ? clientAccount.name : 'N/A';

          return {
            id: campaign.id,
            name: campaign.name,
            clientName: clientName,
            platform: campaign.platform.join(', ') || 'N/A', // Transforma array em string
            objective: campaign.objective.join(', ') || 'N/A', // Transforma array em string
            status: campaign.status,
            dailyBudget: campaign.daily_budget,
          };
        });
        setCampaigns(mappedCampaigns);
        setTotalItems(response.data.pagination?.totalItems || 0);
        setTotalPages(response.data.pagination?.totalPages || 0);
      } else {
        console.error('[CampaignManager] Estrutura de dados inesperada da API de campanhas:', response.data);
        setCampaigns([]); // Garante que campaigns seja um array vazio para evitar o erro
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Erro ao buscar dados das campanhas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as campanhas.',
        variant: 'destructive',
      });
      setCampaigns([]); // Garante que campaigns seja um array vazio em caso de erro
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setIsLoadingData(false);
    }
  }, [token, currentPage, itemsPerPage, sortBy, sortOrder, searchTerm, filterStatus, filterClientAccount, availableClientAccounts, toast, API_URL]);


  // Efeitos para carregar dados
  useEffect(() => {
    if (!authLoading && isAuthenticated && token) {
      fetchClientAccounts();
    }
  }, [authLoading, isAuthenticated, token, fetchClientAccounts]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && token && availableClientAccounts.length > 0) { // Garante que as contas de cliente já foram carregadas
      fetchData();
    }
  }, [authLoading, isAuthenticated, token, fetchData, availableClientAccounts]);


  const handleOpenForm = (campaign?: CampaignListItem) => {
    if (campaign) {
      // Para edição, precisamos buscar os dados completos da campanha
      const fetchFullCampaignData = async () => {
        try {
          const response = await axios.get<CampaignResponse>(`${API_URL}/api/campaigns?id=${campaign.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('[CampaignManager] Dados completos da campanha para edição:', response.data);
          if (response.data) {
            setEditingCampaignData({
              id: response.data.id,
              name: response.data.name,
              status: response.data.status,
              selectedClientAccountId: response.data.selectedClientAccountId,
              platform: response.data.platform,
              objective: response.data.objective,
              ad_format: response.data.ad_format,
              budget: response.data.budget,
              daily_budget: response.data.daily_budget,
              start_date: response.data.start_date,
              end_date: response.data.end_date,
              target_audience_description: response.data.target_audience_description,
              industry: response.data.industry,
              segmentation_notes: response.data.segmentation_notes,
              avg_ticket: response.data.avg_ticket,
              external_campaign_id: response.data.external_campaign_id,
              platform_source: response.data.platform_source,
              external_platform_account_id: response.data.external_platform_account_id,
            });
            setIsFormOpen(true);
          }
        } catch (error) {
          console.error('Erro ao carregar dados completos da campanha para edição:', error);
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os detalhes da campanha para edição.',
            variant: 'destructive',
          });
        }
      };
      fetchFullCampaignData();
    } else {
      setEditingCampaignData(null); // Para criação de nova campanha
      setIsFormOpen(true);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCampaignData(null);
  };

  const handleSaveCampaign = async (formData: CampaignFormData) => {
    if (!token) return;

    try {
      if (formData.id) {
        // Edição
        await axios.put(`${API_URL}/api/campaigns?id=${formData.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: 'Sucesso', description: 'Campanha atualizada com sucesso.' });
      } else {
        // Criação
        await axios.post(`${API_URL}/api/campaigns`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: 'Sucesso', description: 'Campanha criada com sucesso.' });
      }
      handleCloseForm();
      fetchData(); // Recarrega a lista de campanhas
    } catch (error: any) {
      console.error('Erro ao salvar campanha:', error.response?.data || error.message);
      toast({
        title: 'Erro',
        description: `Não foi possível salvar a campanha: ${error.response?.data?.details || error.response?.data?.error || error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!token) return;

    if (window.confirm('Tem certeza que deseja excluir esta campanha?')) {
      try {
        await axios.delete(`${API_URL}/api/campaigns?id=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: 'Sucesso', description: 'Campanha excluída com sucesso.' });
        fetchData(); // Recarrega a lista
      } catch (error: any) {
        console.error('Erro ao excluir campanha:', error.response?.data || error.message);
        toast({
          title: 'Erro',
          description: `Não foi possível excluir a campanha: ${error.response?.data?.details || error.response?.data?.error || error.message}`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Volta para a primeira página ao mudar a ordenação
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Renderiza um spinner ou mensagem de carregamento enquanto autentica ou carrega dados
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen text-gray-400">
          Carregando autenticação ou redirecionando...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-50">Gestão de Tráfego</h1>
          <Button onClick={() => handleOpenForm()} className="bg-neon-blue hover:bg-neon-blue-muted text-white shadow-lg transition-all duration-300 ease-in-out hover:neumorphic-neon-outset-glow">
            <PlusCircle className="mr-2 h-5 w-5" /> Adicionar Campanha
          </Button>
        </div>

        <Card className="mb-6 bg-[#1a1c23] border border-[#2a2d34] text-gray-100 shadow-neumorphic-outer-dark">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-50">Filtros de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 placeholder:text-gray-400 focus-visible:ring-neon-blue"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue">
                  <SelectValue placeholder="Filtrar por Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                  <SelectItem value="">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClientAccount} onValueChange={setFilterClientAccount}>
                <SelectTrigger className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue">
                  <SelectValue placeholder="Filtrar por Conta de Cliente" />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                  <SelectItem value="">Todas as Contas</SelectItem>
                  {availableClientAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end p-4">
            <Button onClick={() => fetchData()} className="bg-neon-blue hover:bg-neon-blue-muted text-white transition-all duration-300 ease-in-out hover:neumorphic-neon-outset-glow">
              <Filter className="mr-2 h-4 w-4" /> Aplicar Filtros
            </Button>
          </CardFooter>
        </Card>

        <Card className="bg-[#1a1c23] border border-[#2a2d34] text-gray-100 shadow-neumorphic-outer-dark">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-50">Lista de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex justify-center items-center h-48 text-gray-400">
                Carregando campanhas...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                Nenhuma campanha encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#2a2d34] hover:bg-[#2a2d34]">
                      <TableHead onClick={() => handleSort('name')} className="cursor-pointer text-gray-50">
                        Nome {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="inline-block h-4 w-4 ml-1" /> : <ChevronDown className="inline-block h-4 w-4 ml-1" />)}
                      </TableHead>
                      <TableHead onClick={() => handleSort('clientName')} className="cursor-pointer text-gray-50">
                        Cliente Vinculado {sortBy === 'clientName' && (sortOrder === 'asc' ? <ChevronUp className="inline-block h-4 w-4 ml-1" /> : <ChevronDown className="inline-block h-4 w-4 ml-1" />)}
                      </TableHead>
                      <TableHead className="text-gray-50">Plataforma(s)</TableHead>
                      <TableHead className="text-gray-50">Objetivo(s)</TableHead>
                      <TableHead onClick={() => handleSort('status')} className="cursor-pointer text-gray-50">
                        Status {sortBy === 'status' && (sortOrder === 'asc' ? <ChevronUp className="inline-block h-4 w-4 ml-1" /> : <ChevronDown className="inline-block h-4 w-4 ml-1" />)}
                      </TableHead>
                      <TableHead className="text-gray-50 text-right">Orçamento Diário</TableHead>
                      <TableHead className="text-gray-50"><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} className="border-b border-[#2a2d34] hover:bg-[#20222a]">
                        <TableCell className="font-medium text-gray-100">{campaign.name}</TableCell>
                        <TableCell className="text-gray-200">{campaign.clientName}</TableCell>
                        <TableCell className="text-gray-200">{campaign.platform}</TableCell>
                        <TableCell className="text-gray-200">{campaign.objective}</TableCell>
                        <TableCell className="text-gray-200">{campaign.status}</TableCell>
                        <TableCell className="text-gray-200 text-right">R$ {campaign.dailyBudget.toFixed(2)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:bg-[#3a3d44]">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleOpenForm(campaign)}
                                className="hover:bg-[#3a3d44] focus:bg-[#3a3d44] cursor-pointer"
                              >
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[#3a3d44]" />
                              <DropdownMenuItem
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-400 hover:bg-red-900/20 focus:bg-red-900/20 cursor-pointer"
                              >
                                Excluir
                              </DropdownMenuItem>
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
          <CardFooter className="flex justify-between items-center p-4 border-t border-[#2a2d34]">
            <div className="text-sm text-gray-400">
              Mostrando {campaigns.length} de {totalItems} campanhas.
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                </PaginationItem>
                {[...Array(totalPages)].map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      onClick={() => handlePageChange(index + 1)}
                      isActive={currentPage === index + 1}
                      className={currentPage === index + 1 ? "bg-neon-blue text-white hover:bg-neon-blue-muted" : "text-gray-200 hover:bg-[#3a3d44]"}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>

        <CampaignManagerForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveCampaign}
          campaignData={editingCampaignData}
          availableClientAccounts={availableClientAccounts}
        />
      </div>
    </Layout>
  );
};

export default CampaignManagerPage;
