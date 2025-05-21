// pages/campaign-manager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { PlusCircle, ListFilter, Search, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import CampaignManagerForm, { CampaignFormData, ClientAccountOption } from '@/components/CampaignManagerForm';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import axios from 'axios'; // <<< IMPORTAR AXIOS

interface CampaignListItem extends CampaignFormData {
  id: string;
  clientAccountName?: string;
  platformText?: string;
}

const MOCK_STATUSES = [{value: 'draft', label: 'Rascunho'}, {value: 'active', label: 'Ativa'}, {value: 'paused', label: 'Pausada'}, {value: 'completed', label: 'Concluída'}];

export default function CampaignManagerPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<CampaignFormData> | null>(null);
  
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [availableClientAccounts, setAvailableClientAccounts] = useState<ClientAccountOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const neonColor = '#1E90FF';
  const primaryButtonStyle = `bg-gradient-to-r from-[${neonColor}] to-[#4682B4] hover:from-[#4682B4] hover:to-[${neonColor}] text-white font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)]`;
  const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
  const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9";
  const tableHeaderStyle = "text-xs font-semibold text-gray-400 uppercase tracking-wider";
  const tableCellStyle = "text-sm text-gray-200 py-2.5";
  const statusBadgeColors: { [key: string]: string } = {
    draft: 'bg-gray-500/80 border-gray-400/50 text-gray-100',
    active: 'bg-green-500/80 border-green-400/50 text-green-50 shadow-[0_0_4px_#32CD32]',
    paused: 'bg-yellow-500/80 border-yellow-400/50 text-yellow-50',
    completed: 'bg-blue-500/80 border-blue-400/50 text-blue-50',
    archived: 'bg-slate-600/80 border-slate-500/50 text-slate-300',
  };

  const fetchClientAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get<ClientAccountOption[]>('/api/client-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableClientAccounts(response.data);
    } catch (error) {
      console.error("Erro ao buscar contas de clientes:", error);
      toast({ title: "Erro", description: "Falha ao carregar contas de clientes.", variant: "destructive" });
      setAvailableClientAccounts([]); // Define como array vazio em caso de erro
    }
  }, [token, toast]);

  const fetchCampaigns = useCallback(async () => {
    if (!token || availableClientAccounts.length === 0) { // Espera ter as contas de cliente para mapear nomes
        if (token && availableClientAccounts.length === 0) {
            // Se o token existe mas as contas não foram carregadas (ex: erro no fetchClientAccounts), não prosseguir ou mostrar aviso
            console.warn("fetchCampaigns: Contas de cliente ainda não carregadas ou vazias.");
        }
        setIsLoadingCampaigns(false); // Parar o loading se não puder prosseguir
        return;
    }
    setIsLoadingCampaigns(true);
    try {
      const response = await axios.get<CampaignFormData[]>('/api/campaigns', { // Espera CampaignFormData da API
        headers: { Authorization: `Bearer ${token}` },
      });
      const mappedCampaigns = response.data.map(c => ({
        ...c,
        id: c.id!, // API deve sempre retornar ID
        clientAccountName: availableClientAccounts.find(acc => acc.id === c.selectedClientAccountId)?.name || 'N/A',
        platformText: Array.isArray(c.platform) ? c.platform.join(', ') : (typeof c.platform === 'string' ? c.platform : 'N/A'),
      }));
      setCampaigns(mappedCampaigns);
    } catch (error) {
      console.error("Erro ao buscar campanhas:", error);
      toast({ title: "Erro", description: "Falha ao carregar campanhas.", variant: "destructive" });
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [token, toast, availableClientAccounts]); // Adicionado availableClientAccounts como dependência

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && token) {
      fetchClientAccounts(); // Carrega primeiro as contas de clientes
    }
  }, [authLoading, isAuthenticated, router, token, fetchClientAccounts]);

  // Efeito separado para buscar campanhas APÓS as contas de clientes serem carregadas
  useEffect(() => {
    if (token && availableClientAccounts.length > 0) {
      fetchCampaigns();
    }
  }, [token, availableClientAccounts, fetchCampaigns]);


  const handleOpenForm = (campaign?: CampaignListItem) => {
    const formDataForEdit = campaign ? { 
        ...campaign,
        start_date: campaign.start_date ? new Date(campaign.start_date) : null,
        end_date: campaign.end_date ? new Date(campaign.end_date) : null,
     } : null;
    setEditingCampaign(formDataForEdit);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  const handleSaveCampaign = async (formData: Partial<CampaignFormData>) => {
    if (!token) {
        toast({ title: "Erro de Autenticação", description: "Sessão expirada ou inválida.", variant: "destructive" });
        return;
    }
    setIsLoadingCampaigns(true);
    const method = formData.id ? 'PUT' : 'POST';
    const url = formData.id ? `/api/campaigns?id=${formData.id}` : '/api/campaigns';
    try {
      await axios({ 
        method, 
        url, 
        data: formData, 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast({ title: "Sucesso", description: `Campanha ${formData.id ? `"${formData.name}" atualizada` : `"${formData.name}" criada`}!` });
      fetchCampaigns(); 
    } catch (error: any) {
      toast({ title: "Erro ao Salvar", description: error.response?.data?.message || error.message || "Falha ao salvar campanha.", variant: "destructive" });
      setIsLoadingCampaigns(false); // Para o loading apenas em caso de erro, fetchCampaigns fará em caso de sucesso
    }
    handleCloseForm();
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName?: string) => {
    if (!token) {
        toast({ title: "Erro de Autenticação", description: "Sessão expirada ou inválida.", variant: "destructive" });
        return;
    }
    if (!confirm(`Tem certeza que deseja excluir a campanha "${campaignName || campaignId}"? Esta ação não pode ser desfeita.`)) return;
    
    setIsLoadingCampaigns(true);
    try {
        await axios.delete(`/api/campaigns?id=${campaignId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: "Excluído", description: `Campanha "${campaignName || campaignId}" foi excluída.`, variant: "destructive" });
        fetchCampaigns();
    } catch (error: any) {
        toast({ title: "Erro ao Excluir", description: error.response?.data?.message || error.message || "Falha ao excluir campanha.", variant: "destructive" });
        setIsLoadingCampaigns(false);
    }
  };
  
  const filteredCampaigns = campaigns.filter(campaign => 
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (campaign.clientAccountName && campaign.clientAccountName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (campaign.platformText && campaign.platformText.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (authLoading && !token) return <Layout><div className="p-6 text-center">Carregando autenticação...</div></Layout>;
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="searchCampaign" className="text-xs text-gray-300 mb-1 block">Buscar (Nome, Cliente, Plataforma)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                    id="searchCampaign" 
                    placeholder="Digite para buscar..." 
                    className={cn(neumorphicInputStyle, "pl-8 h-8 text-xs")} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Button variant="outline" className="bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 h-8 text-xs mt-3 md:mt-0">
              <ListFilter className="mr-2 h-3.5 w-3.5" /> Aplicar Filtros
            </Button>
          </div>
        </Card>

        <Card className={cn(cardStyle)}>
          <CardHeader className="px-4 py-3 border-b border-[#1E90FF]/10">
            <CardTitle className="text-base font-semibold text-white">Lista de Campanhas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingCampaigns && !authLoading ? (
              <p className="text-center text-gray-400 py-10">Carregando campanhas...</p>
            ) : filteredCampaigns.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Nenhuma campanha encontrada. {searchTerm && "Tente refinar sua busca ou "}Clique em "Adicionar Campanha".</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#1E90FF]/10 hover:bg-transparent">
                      <TableHead className={cn(tableHeaderStyle, "pl-4")}>Nome da Campanha</TableHead>
                      <TableHead className={tableHeaderStyle}>Cliente Vinculado</TableHead>
                      <TableHead className={tableHeaderStyle}>Plataforma(s)</TableHead>
                      <TableHead className={cn(tableHeaderStyle, "text-center")}>Status</TableHead>
                      <TableHead className={cn(tableHeaderStyle, "text-right pr-4")}>Orçamento Diário</TableHead>
                      <TableHead className={cn(tableHeaderStyle, "text-center pr-4")}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map(campaign => (
                      <TableRow key={campaign.id} className="border-b border-[#1E90FF]/5 hover:bg-[#0A0B0F]/50 transition-colors">
                        <TableCell className={cn(tableCellStyle, "font-medium pl-4")}>{campaign.name}</TableCell>
                        <TableCell className={tableCellStyle}>{campaign.clientAccountName || 'N/A'}</TableCell>
                        <TableCell className={tableCellStyle}>{campaign.platformText || 'N/A'}</TableCell>
                        <TableCell className={cn(tableCellStyle, "text-center")}>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 border", statusBadgeColors[campaign.status.toLowerCase()] || statusBadgeColors.draft)}>
                            {MOCK_STATUSES.find(s=>s.value === campaign.status)?.label || campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(tableCellStyle, "text-right pr-4")}>
                          {campaign.daily_budget ? `R$ ${Number(campaign.daily_budget).toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className={cn(tableCellStyle, "text-center pr-4")}>
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-7 w-7 p-0 data-[state=open]:bg-slate-700">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                              <DropdownMenuItem onClick={() => handleOpenForm(campaign)} className="cursor-pointer hover:!bg-[#1E90FF]/20"><Edit className="mr-2 h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id!, campaign.name)} className="cursor-pointer !text-red-400 hover:!bg-red-700/30"><Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir</DropdownMenuItem>
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
        </Card>
      </div>

      {isFormOpen && (
        <CampaignManagerForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveCampaign}
          campaignData={editingCampaign}
          availableClientAccounts={availableClientAccounts}
        />
      )}
    </Layout>
  );
}
