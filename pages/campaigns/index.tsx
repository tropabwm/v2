// pages/campaigns/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button"; // Mantido para possíveis ações futuras (ex: "Nova Campanha")
import { Loader2, ListChecks } from 'lucide-react'; // Adicionado ListChecks para placeholder
import { useMCPAgentContext } from '@/context/MCPAgentContext'; // Importado para revalidação
import axios from 'axios'; // Importado para buscar campanhas
import { useToast } from "@/components/ui/use-toast"; // Para feedback

// Definindo uma interface básica para os dados da campanha
interface Campaign {
    id: string | number;
    name: string;
    status?: string;
    daily_budget?: number;
    // Adicione outros campos que você espera da API
}

export default function CampaignsPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { lastDataChangeTimestamp, notifyDataChange } = useMCPAgentContext(); // Usado para revalidação

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [pageLoading, setPageLoading] = useState<boolean>(true); // Loading da página/dados
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchCampaigns = useCallback(async () => {
        if (!isAuthenticated) return;
        console.log("Buscando campanhas...");
        setPageLoading(true);
        setFetchError(null);
        try {
            const response = await axios.get<Campaign[]>('/api/campaigns');
            setCampaigns(response.data || []);
            console.log("Campanhas carregadas:", response.data);
        } catch (error) {
            console.error("Erro ao buscar campanhas:", error);
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : (error as Error).message;
            setFetchError(errorMsg || "Não foi possível carregar as campanhas.");
            toast({
                title: "Erro ao Carregar Campanhas",
                description: errorMsg || "Tente novamente mais tarde.",
                variant: "destructive",
            });
            setCampaigns([]);
        } finally {
            setPageLoading(false);
        }
    }, [isAuthenticated, toast]);

    // Efeito para carregamento inicial e autenticação
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated) {
            fetchCampaigns();
        }
    }, [authLoading, isAuthenticated, router, fetchCampaigns]);

    // Efeito para revalidar dados quando o agente Ubie fizer alterações
    useEffect(() => {
        if (isAuthenticated && lastDataChangeTimestamp > 0) { // lastDataChangeTimestamp > 0 para evitar fetch no mount inicial do contexto
            console.log(`[CampaignsPage] Timestamp de alteração detectado (${lastDataChangeTimestamp}), recarregando campanhas...`);
            toast({
                title: "Atualização de Dados",
                description: "Novos dados de campanha podem estar disponíveis. Atualizando lista...",
                duration: 3000,
            });
            fetchCampaigns();
        }
    }, [lastDataChangeTimestamp, isAuthenticated, fetchCampaigns, toast]);


    if (authLoading || (pageLoading && campaigns.length === 0 && !fetchError)) {
        return (
            <Layout>
                <div className="flex h-[calc(100vh-theme(spacing.16))] w-full items-center justify-center"> {/* Ajustado para altura da tela menos header */}
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">
                        {authLoading ? 'Verificando autenticação...' : 'Carregando campanhas...'}
                    </span>
                </div>
            </Layout>
        );
    }

    if (!isAuthenticated) { // Fallback caso o redirecionamento do useEffect não ocorra a tempo
        return null;
    }

    return (
        <Layout>
            <Head><title>Gerenciamento de Campanhas - USBMKT</title></Head>
            <div className="container mx-auto p-4 md:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Gerenciamento de Campanhas</h1>
                    <Button
                        onClick={() => {
                            // Aqui você pode abrir um modal para criar nova campanha ou navegar para uma página de criação
                            // Por exemplo, notificar o Ubie para ajudar a criar:
                            // sendMessageToUbie("quero criar uma nova campanha");
                            // toggleAgentPanel(true);
                            toast({ title: "Nova Campanha", description: "Funcionalidade de criar nova campanha aqui." });
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        + Nova Campanha
                    </Button>
                </div>

                {fetchError && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-md text-center">
                        <p><strong>Erro:</strong> {fetchError}</p>
                        <Button variant="outline" size="sm" onClick={fetchCampaigns} className="mt-2">
                            Tentar Novamente
                        </Button>
                    </div>
                )}

                {!pageLoading && !fetchError && campaigns.length === 0 && (
                    <div className="text-center text-muted-foreground py-10">
                        <ListChecks className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="text-lg">Nenhuma campanha encontrada.</p>
                        <p className="text-sm">Crie sua primeira campanha para começar.</p>
                    </div>
                )}

                {!pageLoading && !fetchError && campaigns.length > 0 && (
                    <div className="bg-slate-800/50 shadow-xl rounded-lg p-4 md:p-6">
                        <h2 className="text-xl font-semibold text-slate-200 mb-4">Suas Campanhas</h2>
                        {/* Aqui viria a tabela ou lista de cards das campanhas */}
                        <ul className="space-y-3">
                            {campaigns.map((campaign) => (
                                <li key={campaign.id} className="p-3 bg-slate-700/50 rounded-md shadow hover:bg-slate-600/50 transition-colors">
                                    <h3 className="font-medium text-sky-400">{campaign.name}</h3>
                                    <p className="text-xs text-slate-400">
                                        Status: {campaign.status || 'N/D'} - Orçamento Diário: {campaign.daily_budget ? `R$ ${Number(campaign.daily_budget).toFixed(2)}` : 'N/D'}
                                    </p>
                                    {/* Adicionar botões de ação (editar, ver detalhes, deletar) aqui */}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-xs text-gray-500">
                            Exibindo {campaigns.length} campanha(s).
                            A interface completa de gerenciamento (tabela, filtros, paginação, formulário de edição) será implementada aqui.
                        </p>
                    </div>
                )}

                 {/* Botão de teste para forçar a revalidação via UbieContext, se necessário para debug */}
                 {/*
                 <Button onClick={() => {
                    console.log("Forçando notificação de mudança de dados para teste.");
                    notifyDataChange();
                 }} className="mt-4">Testar Revalidação Ubie</Button>
                 */}
            </div>
        </Layout>
    );
}
