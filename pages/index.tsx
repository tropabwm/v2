import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    RefreshCw, Loader2, AlertTriangle, Calendar as CalendarIcon, DollarSign, TrendingUp, Activity, Users, MousePointerClick, ShoppingCart, LineChart as LineChartIconProp, CreditCard, Percent, BarChart2 as BarChartIcon
} from 'lucide-react';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import axios from 'axios';
import GlassStatCard from '@/components/dashboard/GlassStatCard';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AggregatedMetrics {
    totalRevenue: number;
    totalClicks: number;
    totalSales: number;
    totalCost: number;
    totalImpressions: number;
    totalBudget?: number;
    ctr: number | null;
    cpc: number | null;
    conversionRate: number | null;
    costPerConversion: number | null;
    roi: number | null;
    useBudget: number | null;
    budgetRemaining: number | null;
    realProfit: number;
    realProfitMargin: number | null;
}

interface DailyDataPoint {
    date: string;
    revenue: number;
    clicks: number;
    impressions?: number;
    conversions?: number;
    cost?: number;
}

interface DashboardData {
    totals: AggregatedMetrics;
    dailyData: DailyDataPoint[];
    totalUsers?: number;
    userChange?: number | null;
    revenueChange?: number | null;
    clickChange?: number | null;
    salesChange?: number | null;
    conversionRateChange?: number | null;
    useBudgetChange?: number | null;
    roiChange?: number | null;
    profitChange?: number | null;
    budgetRemainingChange?: number | null;
}

type CampaignOption = { id: string; name: string };

const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy';
const DATE_FORMAT_AXIS = 'dd/MM';
const DATE_FORMAT_API = 'yyyy-MM-dd';
const DEFAULT_TIMEFRAME_DAYS = 30;

// !! IMPORTANTE: Substitua '#5271FF' pelo HEX EXATO do azul da sua sidebar !!
const SIDEBAR_BLUE_NEON = '#5271FF';
const CHART_LINE_COLOR_1 = SIDEBAR_BLUE_NEON; // Linha principal do gráfico
const CHART_LINE_COLOR_2 = '#9f7aea'; // Roxo neon para a segunda linha, ou escolha outro azul/cor

// Utility function for safe array operations
const safeArray = (value, fallback = []) => {
    return Array.isArray(value) ? value : fallback;
};

// Debug helper for troubleshooting
const debugArrayState = (array, label = 'array') => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${label}:`, {
            value: array,
            type: typeof array,
            isArray: Array.isArray(array),
            length: array?.length,
        });
    }
    return array;
};

const formatMetricValue = (metricKey: string, value: any): string => {
    const numValue = Number(value);
    if (value === undefined || value === null || isNaN(numValue)) return 'N/A';
    if (!isFinite(numValue)) return value > 0 ? '+∞' : '-∞';
    const lowerMetricKey = metricKey.toLowerCase();
    if (['click', 'impression', 'conversion', 'users', 'leads', 'sales'].some(k => lowerMetricKey.includes(k))) {
        return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
    if (['ctr', 'rate', 'roi', 'usebudget', 'margin'].some(k => lowerMetricKey.includes(k))) {
        return `${numValue.toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits: 1 })}%`;
    }
    if (['cpc', 'cost', 'revenue', 'budget', 'ltv', 'ticket', 'profit', 'remaining'].some(k => lowerMetricKey.includes(k))) {
        return `R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

const formatXAxis = (tickItem: string): string => { 
    try { 
        const date = parseISO(tickItem); 
        return isValid(date) ? format(date, DATE_FORMAT_AXIS, { locale: ptBR }) : ''; 
    } catch { 
        return ''; 
    } 
};

const formatYAxis = (tickItem: number): string => { 
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`; 
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`; 
    return tickItem.toLocaleString('pt-BR', { maximumFractionDigits: 0 }); 
};

const formatTooltipValue = (value: number, name: string): [string] | [string, string] => { 
    const keyForFormatting = name.toLowerCase().replace(/\s+/g, ''); 
    return [`${name}: ${formatMetricValue(keyForFormatting, value)}`]; 
};

export default function DashboardPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    
    // FIXED: Initialize campaigns as empty array to prevent .map() errors
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), DEFAULT_TIMEFRAME_DAYS - 1),
        to: new Date(),
    });
    
    // FIXED: Initialize dashboardData with safe structure
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const { toast } = useToast();

    const filterCardStyle = `bg-black/40 backdrop-blur-lg border border-[${SIDEBAR_BLUE_NEON}]/30 shadow-[0_0_15px_rgba(0,0,0,0.3),0_0_10px_${SIDEBAR_BLUE_NEON}22] rounded-xl`;
    const inputStyle = `bg-black/30 border-[${SIDEBAR_BLUE_NEON}]/40 placeholder-gray-400 text-gray-200 focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent focus:ring-[${SIDEBAR_BLUE_NEON}] focus:border-[${SIDEBAR_BLUE_NEON}] rounded-md transition-all`;
    const buttonStyle = `bg-gradient-to-r from-[${SIDEBAR_BLUE_NEON}] to-[#7c5df0] hover:from-[#7c5df0] hover:to-[${SIDEBAR_BLUE_NEON}] text-white font-semibold rounded-md shadow-md hover:shadow-lg active:scale-95 transition-all`;

    const loadCampaigns = useCallback(async () => { 
        if (!isAuthenticated) return; 
        setCampaignsLoading(true); 
        setApiError(null); 
        
        try { 
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name&sort=name:asc'); 
            
            // FIXED: Validate API response is an array
            const campaignData = response.data;
            if (Array.isArray(campaignData)) {
                setCampaigns(campaignData);
                debugArrayState(campaignData, 'campaigns from API');
            } else {
                console.warn('API returned non-array campaigns data:', campaignData);
                setCampaigns([]);
                setApiError("Formato de dados de campanhas inválido.");
            }
        } catch (error) { 
            const errorMsg = axios.isAxiosError(error) 
                ? error.response?.data?.message || error.message 
                : (error as Error).message; 
            
            toast({ 
                title: "Erro Campanhas", 
                description: errorMsg || "Não foi possível carregar as campanhas.", 
                variant: "destructive" 
            }); 
            
            // FIXED: Always set campaigns to empty array on error
            setCampaigns([]); 
            setApiError("Erro ao carregar campanhas."); 
        } finally { 
            setCampaignsLoading(false); 
        } 
    }, [toast, isAuthenticated]);

    const loadDashboardData = useCallback(async (isRefresh = false) => { 
        if (!isAuthenticated || !dateRange?.from) return; 
        
        if (!isRefresh) setLoading(true); 
        else setRefreshing(true); 
        setApiError(null); 
        
        const startDateStr = format(dateRange.from, DATE_FORMAT_API); 
        const endDate = dateRange.to || dateRange.from; 
        const endDateStr = format(endDate, DATE_FORMAT_API); 
        const campIdToSend = selectedCampaignId === 'all' ? undefined : selectedCampaignId; 
        
        try { 
            const response = await axios.get<DashboardData>('/api/dashboard', { 
                params: { 
                    startDate: startDateStr, 
                    endDate: endDateStr, 
                    campaignId: campIdToSend 
                } 
            }); 
            
            const data = response.data; 
            
            // FIXED: Validate and sanitize dashboard data structure
            if (data && typeof data === 'object') {
                const sanitizedData: DashboardData = {
                    totals: data.totals || {
                        totalRevenue: 0,
                        totalClicks: 0,
                        totalSales: 0,
                        totalCost: 0,
                        totalImpressions: 0,
                        totalBudget: 0,
                        ctr: null,
                        cpc: null,
                        conversionRate: null,
                        costPerConversion: null,
                        roi: null,
                        useBudget: null,
                        budgetRemaining: null,
                        realProfit: 0,
                        realProfitMargin: null,
                    },
                    // FIXED: Ensure dailyData is always an array
                    dailyData: Array.isArray(data.dailyData) ? data.dailyData : [],
                    totalUsers: data.totalUsers,
                    userChange: data.userChange,
                    revenueChange: data.revenueChange,
                    clickChange: data.clickChange,
                    salesChange: data.salesChange,
                    conversionRateChange: data.conversionRateChange,
                    useBudgetChange: data.useBudgetChange,
                    roiChange: data.roiChange,
                    profitChange: data.profitChange,
                    budgetRemainingChange: data.budgetRemainingChange,
                };
                
                debugArrayState(sanitizedData.dailyData, 'dailyData from API');
                setDashboardData(sanitizedData); 
                
                if (isRefresh) {
                    toast({ title: "Dashboard Atualizado", duration: 2000 }); 
                }
            } else { 
                setDashboardData(null); 
                setApiError("API retornou dados em formato inesperado ou vazios."); 
                toast({ 
                    title: "Erro Dashboard", 
                    description: "Dados recebidos da API estão incompletos.", 
                    variant: "destructive" 
                }); 
            } 
        } catch (error: any) { 
            console.error('[Dashboard] Erro ao carregar dados:', error.response?.data || error.message); 
            const errorMsg = error.response?.data?.details 
                || error.response?.data?.error 
                || error.message 
                || 'Ocorreu um erro desconhecido ao buscar dados.'; 
            
            setApiError(errorMsg); 
            setDashboardData(null); 
            toast({ 
                title: "Erro Dashboard", 
                description: errorMsg, 
                variant: "destructive" 
            }); 
        } finally { 
            if (!isRefresh) setLoading(false); 
            else setRefreshing(false); 
        } 
    }, [dateRange, selectedCampaignId, toast, isAuthenticated]);

    useEffect(() => { 
        if (!authLoading && !isAuthenticated) {
            router.push('/login'); 
        } else if (!authLoading && isAuthenticated) {
            loadCampaigns(); 
        }
    }, [authLoading, isAuthenticated, router, loadCampaigns]);

    useEffect(() => { 
        if (isAuthenticated && !campaignsLoading && dateRange?.from) { 
            loadDashboardData(); 
        } 
    }, [selectedCampaignId, dateRange, isAuthenticated, campaignsLoading, loadDashboardData]);

    const renderRevenueClicksChart = () => {
        // FIXED: Safe access to dailyData with fallback
        const data = safeArray(dashboardData?.dailyData, []);
        debugArrayState(data, 'chart data');
        
        const gridColor = `rgba(${hexToRgbArray(SIDEBAR_BLUE_NEON).join(',')}, 0.1)`;
        const tooltipBg = "rgba(10, 20, 30, 0.9)";
        const tooltipBorder = `${SIDEBAR_BLUE_NEON}50`;
        const axisLabelStyle = { fill: SIDEBAR_BLUE_NEON, fontSize: 10 };
        const legendStyle = { 
            color: SIDEBAR_BLUE_NEON, 
            fontSize: '11px', 
            paddingTop: '15px', 
            textShadow: `0 0 2px ${SIDEBAR_BLUE_NEON}80` 
        };

        if (loading || refreshing) { 
            return (
                <div className="flex flex-col items-center justify-center h-[250px]">
                    <Loader2 className="h-6 w-6 animate-spin" style={{color: SIDEBAR_BLUE_NEON}} />
                    <span className="text-xs mt-2" style={{color: SIDEBAR_BLUE_NEON, textShadow: `0 0 3px ${SIDEBAR_BLUE_NEON}70`}}>
                        Carregando gráfico...
                    </span>
                </div>
            ); 
        }
        
        if (!data || data.length === 0) { 
            return (
                <div className="flex items-center justify-center h-[250px] text-gray-500 text-sm">
                    Sem dados para o gráfico.
                </div>
            ); 
        }
        
        return (
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                        <filter id="neonGlowLine1" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/> 
                            <feMerge> 
                                <feMergeNode in="coloredBlur"/> 
                                <feMergeNode in="SourceGraphic"/> 
                            </feMerge>
                        </filter>
                        <filter id="neonGlowLine2" x="-50%" y="-50%" width="200%" height="200%">
                            <feComponentTransfer in="SourceAlpha" result="alphaMask">
                                <feFuncA type="table" tableValues="0 0.6 0.6"/>
                            </feComponentTransfer>
                            <feGaussianBlur in="alphaMask" stdDeviation="2.5" result="blurredAlpha"/>
                            <feFlood floodColor={CHART_LINE_COLOR_2} result="glowColor"/>
                            <feComposite in="glowColor" in2="blurredAlpha" operator="in" result="softGlow_colored"/>
                            <feMerge>
                                <feMergeNode in="softGlow_colored"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} tick={axisLabelStyle} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                    <YAxis yAxisId="left" tickFormatter={formatYAxis} tick={axisLabelStyle} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={formatYAxis} tick={{...axisLabelStyle, fill: CHART_LINE_COLOR_2 }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }}/>
                    <Tooltip
                        contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', backdropFilter: 'blur(5px)', boxShadow: `0 4px 30px ${SIDEBAR_BLUE_NEON}20` }}
                        labelStyle={{ color: SIDEBAR_BLUE_NEON, fontSize: '12px', marginBottom: '5px', fontWeight: 'bold', textShadow: `0 0 2px ${SIDEBAR_BLUE_NEON}90` }}
                        itemStyle={{ color: 'white', fontSize: '12px' }}
                        formatter={formatTooltipValue}
                    />
                    <Legend wrapperStyle={legendStyle} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" name="Receita" stroke={CHART_LINE_COLOR_1} strokeWidth={2.5}
                          dot={{ r: 2, strokeWidth: 1, fill: CHART_LINE_COLOR_1 }}
                          activeDot={{ r: 5, strokeWidth: 1, fill: CHART_LINE_COLOR_1, stroke: '#0A0F1A', style:{ filter: `url(#neonGlowLine1)`} }}
                          style={{ filter: `drop-shadow(0 0 5px ${CHART_LINE_COLOR_1}B0)` }} />
                    <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke={CHART_LINE_COLOR_2} strokeWidth={2.5}
                          dot={{ r: 2, strokeWidth: 1, fill: CHART_LINE_COLOR_2 }}
                          activeDot={{ r: 5, strokeWidth: 1, fill: CHART_LINE_COLOR_2, stroke: '#0A0F1A', style:{ filter: `url(#neonGlowLine2)`} }}
                          style={{ filter: `drop-shadow(0 0 5px ${CHART_LINE_COLOR_2}B0)` }}/>
                </LineChart>
            </ResponsiveContainer>
        );
    };

    // Função auxiliar para converter HEX para array RGB (para rgba)
    const hexToRgbArray = (hex: string): number[] => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0,0,0];
    };

    if (authLoading) { 
        return ( 
            <Layout>
                <div className="flex items-center justify-center h-screen w-full">
                    <Loader2 className="h-10 w-10 animate-spin" style={{color: SIDEBAR_BLUE_NEON}} />
                </div>
            </Layout> 
        ); 
    }
    
    if (!isAuthenticated) return null;
    
    if (campaignsLoading && campaigns.length === 0 && apiError && !loading) { 
        return ( 
            <Layout>
                <div className="flex flex-col items-center justify-center h-screen w-full text-red-400 text-center p-5">
                    <AlertTriangle className="h-10 w-10 mb-4" />
                    <h2 className="text-lg font-semibold mb-1">Erro ao Carregar Campanhas</h2>
                    <p className="text-sm mb-4">{apiError}</p>
                    <Button className={cn(buttonStyle, "px-4 h-10")} size="sm" onClick={loadCampaigns}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tentar Novamente
                    </Button>
                </div>
            </Layout> 
        ); 
    }

    const cardsLoading = loading || refreshing;

    return (
        <Layout>
            <Head>
                <title>Dashboard Visão Geral - USBMKT</title>
                <meta name="description" content="Visão geral do seu desempenho de marketing." />
            </Head>
            <div className="p-4 md:p-6 lg:p-8 space-y-6 min-h-screen text-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                    <div>
                        <h1
                            className="text-3xl font-bold text-white"
                            style={{ textShadow: `0 0 7px ${SIDEBAR_BLUE_NEON}, 0 0 10px ${SIDEBAR_BLUE_NEON}C0, 0 0 15px ${SIDEBAR_BLUE_NEON}90` }}
                        >
                            Visão Geral
                        </h1>
                        <p className="text-sm text-gray-300" style={{textShadow: `0 0 2px ${SIDEBAR_BLUE_NEON}80`}}>
                            Métricas chave de suas campanhas.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 sm:mt-0">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date_range_trigger" variant={"outline"} className={cn(inputStyle, "w-full sm:w-auto h-10 px-4 text-xs justify-start text-left font-normal")} disabled={cardsLoading}>
                                    <CalendarIcon className="h-4 w-4 mr-2 opacity-70" style={{color: SIDEBAR_BLUE_NEON}}/>
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, DATE_FORMAT_DISPLAY, { locale: ptBR })} - {format(dateRange.to, DATE_FORMAT_DISPLAY, { locale: ptBR })}</>) : (format(dateRange.from, DATE_FORMAT_DISPLAY, { locale: ptBR }))) : (<span>Selecione Período</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-black/80 backdrop-blur-lg border-blue-500/30 text-white rounded-lg shadow-2xl" align="end">
                                <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}
                                classNames={{
                                    day_selected: `bg-[${SIDEBAR_BLUE_NEON}] text-black hover:bg-[${SIDEBAR_BLUE_NEON}]/90 focus:bg-[${SIDEBAR_BLUE_NEON}]`,
                                    day_today: `text-[${SIDEBAR_BLUE_NEON}] ring-1 ring-[${SIDEBAR_BLUE_NEON}]`,
                                    day_range_middle: `aria-selected:bg-[${SIDEBAR_BLUE_NEON}]/30 aria-selected:text-white`,
                                }}/>
                            </PopoverContent>
                        </Popover>
                        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={cardsLoading || campaignsLoading}>
                            <SelectTrigger className={cn(inputStyle, "w-full sm:w-[200px] h-10 px-4 text-xs")}>
                                <SelectValue placeholder={campaignsLoading ? "Carregando..." : "Campanha"} />
                            </SelectTrigger>
                            <SelectContent className="bg-black/80 backdrop-blur-lg border-blue-500/30 text-white rounded-lg shadow-2xl">
                                <SelectItem value="all" className="text-xs hover:!bg-blue-600/50 focus:!bg-blue-600/50">
                                    Todas Campanhas
                                </SelectItem>
                                {/* FIXED: Safe mapping with array validation */}
                                {safeArray(campaigns).map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs hover:!bg-blue-600/50 focus:!bg-blue-600/50">
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={() => loadDashboardData(true)} className={cn(buttonStyle, "h-10 px-4")} disabled={cardsLoading || campaignsLoading || !dateRange?.from}>
                            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {apiError && !cardsLoading && (
                    <div className="my-4 p-4 bg-red-800/30 border border-red-600/50 rounded-xl text-red-300 text-sm text-center">
                        <AlertTriangle className="inline-block h-5 w-5 mr-2" />
                        <strong>Erro:</strong> {apiError}
                    </div>
                )}
                
                {loading && !refreshing && !apiError && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin" style={{color: SIDEBAR_BLUE_NEON}} />
                        <p className="mt-3 text-gray-400">Carregando dados...</p>
                    </div>
                )}
                
                {!loading && !apiError && !dashboardData && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <BarChartIcon className="h-16 w-16 mb-4" />
                        <p>Nenhum dado para exibir.</p>
                        <p className="text-xs mt-1">Verifique os filtros ou adicione dados de campanha.</p>
                    </div>
                )}

                {dashboardData && !apiError && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <GlassStatCard label="Receita" value={formatMetricValue('revenue', dashboardData.totals.totalRevenue)} icon={DollarSign} percentageChange={dashboardData.revenueChange} isLoading={cardsLoading} />
                            <GlassStatCard label="Lucro Real" value={formatMetricValue('realProfit', dashboardData.totals.realProfit)} icon={TrendingUp} percentageChange={dashboardData.profitChange} isLoading={cardsLoading} />
                            <GlassStatCard label="Cliques" value={formatMetricValue('clicks', dashboardData.totals.totalClicks)} icon={MousePointerClick} percentageChange={dashboardData.clickChange} isLoading={cardsLoading} />
                            <GlassStatCard label="Vendas" value={formatMetricValue('sales', dashboardData.totals.totalSales)} icon={ShoppingCart} percentageChange={dashboardData.salesChange} isLoading={cardsLoading} />
                            <GlassStatCard label="ROI" value={formatMetricValue('roi', dashboardData.totals.roi)} icon={Percent} percentageChange={dashboardData.roiChange} isLoading={cardsLoading} />
                            <GlassStatCard label="CPC" value={formatMetricValue('cpc', dashboardData.totals.cpc)} icon={CreditCard} percentageChange={null} isLoading={cardsLoading} />
                            <GlassStatCard label="CTR" value={formatMetricValue('ctr', dashboardData.totals.ctr)} icon={Activity} percentageChange={null} isLoading={cardsLoading} />
                            <GlassStatCard label="Taxa de Conversão" value={formatMetricValue('conversionRate', dashboardData.totals.conversionRate)} icon={LineChartIconProp} percentageChange={dashboardData.conversionRateChange} isLoading={cardsLoading} />
                            <GlassStatCard label="Orçamento Restante" value={formatMetricValue('budgetRemaining', dashboardData.totals.budgetRemaining)} icon={DollarSign} percentageChange={dashboardData.budgetRemainingChange} isLoading={cardsLoading} />
                            {dashboardData.totalUsers && (
                            <GlassStatCard label="Usuários Únicos" value={formatMetricValue('users', dashboardData.totalUsers)} icon={Users} percentageChange={dashboardData.userChange} isLoading={cardsLoading} />
                            )}
                        </div>

                        <Card className={filterCardStyle}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-semibold text-white" style={{textShadow: `0 0 5px ${SIDEBAR_BLUE_NEON}80`}}>
                                    Evolução Diária - Receita vs Cliques
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {renderRevenueClicksChart()}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </Layout>
    );
}
