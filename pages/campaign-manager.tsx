// pages/campaign-manager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PlusCircle, ListFilter, Search, Edit, Trash2, ExternalLink } from 'lucide-react';
import CampaignManagerForm, { CampaignFormData, ClientAccountOption } from '@/components/CampaignManagerForm';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Para status
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Para ações
import { MoreHorizontal } from "lucide-react";


// Interface para a campanha como listada na página (pode ser diferente de CampaignFormData)
interface CampaignListItem extends CampaignFormData {
  id: string; // ID é obrigatório na listagem
  clientAccountName?: string; // Nome da conta de cliente para exibição
  platformText?: string; // Plataformas formatadas para exibição
}

// DADOS MOCKADOS - SUBSTITUIR PELA API REAL
const MOCK_AVAILABLE_CLIENT_ACCOUNTS: ClientAccountOption[] = [
  { id: 'client_acc_1', name: 'Loja XPTO - Google Ads', platform: 'google', platformAccountId: 'customers/1234567890' },
  { id: 'client_acc_2', name: 'Serviços ABC - Meta Ads', platform: 'meta', platformAccountId: 'act_9876543210' },
  { id: 'client_acc_3', name: 'Imobiliária Z - Google Ads', platform: 'google', platformAccountId: 'customers/1122334455' },
];

const MOCK_CAMPAIGNS: CampaignListItem[] = [
    { 
        id: 'camp1', name: 'Promoção Verão - Loja XPTO', status: 'active', 
        selectedClientAccountId: 'client_acc_1', clientAccountName: 'Loja XPTO - Google Ads',
        platform: ['google'], platformText: 'Google Ads',
        daily_budget: 50, start_date: new Date('2024-01-15'),
        objective: ['vendas'], ad_format: ['imagem'],
    },
    { 
        id: 'camp2', name: 'Leads Qualificados - Serviços ABC', status: 'paused', 
        selectedClientAccountId: 'client_acc_2', clientAccountName: 'Serviços ABC - Meta Ads',
        platform: ['meta'], platformText: 'Meta Ads',
        daily_budget: 30, start_date: new Date('2024-02-01'),
        objective: ['leads'], ad_format: ['video'],
    },
];
// FIM DOS DADOS MOCKADOS

export default function CampaignManagerPage() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth(); // Adicionado token
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
    // TODO: Implementar API real: GET /api/client-accounts (ou similar)
    // Por enquanto, usando mock
    console.log("Simulando fetch de contas de clientes...");
    setAvailableClientAccounts(MOCK_AVAILABLE_CLIENT_ACCOUNTS);
  }, [token]);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setIsLoadingCampaigns(true);
    // TODO: Implementar API real: GET /api/campaigns
    // Por enquanto, usando mock e mapeando para CampaignListItem
    console.log("Simulando fetch de campanhas...");
    const mappedMockCampaigns = MOCK_CAMPAIGNS.map(c => ({
        ...c,
        clientAccountName: MOCK_AVAILABLE_CLIENT_ACCOUNTS.find(acc => acc.id === c.selectedClientAccountId)?.name || 'N/A',
        platformText: c.platform?.join(', ') || 'N/A', // Ajustar conforme a estrutura real de 'platform'
    }));
    setCampaigns(mappedMockCampaigns);
    setIsLoadingCampaigns(false);
  }, [token]);


  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && token) {
      fetchClientAccounts();
      fetchCampaigns();
    }
  }, [authLoading, isAuthenticated, router, token, fetchClientAccounts, fetchCampaigns]);

  const handleOpenForm = (campaign?: CampaignListItem) => {
    // Mapear CampaignListItem para CampaignFormData se necessário para edição
    const formDataForEdit = campaign ? { 
        ...campaign,
        // Garanta que os campos de data sejam objetos Date se vierem como string da lista
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
    setIsLoadingCampaigns(true); // Mostrar feedback de carregamento na lista
    console.log("Salvando campanha (frontend):", formData);
    // TODO: Implementar chamada à API POST/PUT /api/campaigns
    // Exemplo:
    // const method = formData.id ? 'PUT' : 'POST';
    // const url = formData.id ? `/api/campaigns?id=${formData.id}` : '/api/campaigns';
    // try {
    //   await axios({ method, url, data: formData, headers: { Authorization: `Bearer ${token}` } });
    //   toast({ title: "Sucesso", description: `Campanha ${formData.id ? 'atualizada' : 'criada'}!` });
    //   fetchCampaigns(); // Re-fetch da lista
    // } catch (error: any) {
    //   toast({ title: "Erro", description: error.response?.data?.message || "Falha ao salvar.", variant: "destructive" });
    //   setIsLoadingCampaigns(false);
    // }
    // Mock de sucesso por enquanto:
    setTimeout(() => {
        toast({ title: "Sucesso (Mock)", description: `Campanha ${formData.id ? `"${formData.name}" atualizada` : `"${formData.name}" criada`}!` });
        fetchCampaigns(); // Re-fetch (ainda usará mock)
    }, 500);
    handleCloseForm();
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.")) return;
    // TODO: Implementar chamada à API DELETE /api/campaigns?id=${campaignId}
    console.log("Excluindo campanha ID:", campaignId);
    toast({ title: "Excluído (Mock)", description: `Campanha ${campaignId} excluída.`, variant: "destructive" });
    // setCampaigns(prev => prev.filter(c => c.id !== campaignId)); // Atualização otimista
    fetchCampaigns(); // Ou re-fetch
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
            {/* TODO: Adicionar mais filtros (Status, Plataforma, Cliente) */}
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
            {isLoadingCampaigns && !authLoading ? ( // Não mostrar loader de campanhas se auth está carregando
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
                      <TableHead className={cn(tableHeaderStyle, "text-right")}>Orçamento Diário</TableHead>
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
                        <TableCell className={cn(tableCellStyle, "text-right")}>
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
                              {/* <DropdownMenuItem className="cursor-pointer hover:!bg-[#1E90FF]/20"><BarChartBig className="mr-2 h-3.5 w-3.5" /> Ver Detalhes</DropdownMenuItem> */}
                              {/* <DropdownMenuItem className="cursor-pointer hover:!bg-[#1E90FF]/20"><ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir na Plataforma</DropdownMenuItem> */}
                              <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id!)} className="cursor-pointer !text-red-400 hover:!bg-red-700/30"><Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir</DropdownMenuItem>
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
