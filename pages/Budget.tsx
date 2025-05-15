// pages/Budget.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Coins, Target, Scale, Sigma, Minus, TrendingUp, AlertTriangle, Info, BarChartHorizontal, DollarSign, Percent, PieChart as PieChartIconLucide } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import axios from 'axios';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import Image from 'next/image';
import type { Campaign } from '@/entities/Campaign';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';


type PieChartDataItem = {
    name: string;
    value: number;
    color: string;
};

type BudgetData = {
    totalBudget?: number; totalBudgetFmt?: string;
    totalRealCost?: number; totalRealCostFmt?: string;
    totalRevenue?: number; totalRevenueFmt?: string;
    realProfit?: number; realProfitFmt?: string;
    budgetUsedPerc?: number;
    budgetRemaining?: number; budgetRemainingFmt?: string;
    realProfitMargin?: number | null;
    trafficCost?: number; trafficCostFmt?: string; trafficPerc?: number;
    creativeCost?: number; creativeCostFmt?: string; creativePerc?: number;
    operationalCost?: number; operationalCostFmt?: string; opPerc?: number;
    unallocatedValue?: number; unallocatedFmt?: string; unallocatedPerc?: number;
    chartImageUrl?: string | null; // Mantido para fallback se pieChartData não vier
    pieChartData?: PieChartDataItem[]; // NOVO: Dados para o gráfico de pizza Recharts
};
type CampaignOption = Pick<Campaign, 'id' | 'name'>;

const DATE_FORMAT_API = 'yyyy-MM-dd';
const DEFAULT_PERIOD_DAYS = 30;

const formatCurrency = (value: number | undefined | null, defaultValue = 'R$ 0,00'): string => {
    const numValue = Number(value);
    return isNaN(numValue) ? defaultValue : numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const formatPercent = (value: number | undefined | null, defaultValue = '0.0%'): string => {
    const numValue = Number(value);
    if (isNaN(numValue) || value === null || value === undefined) return defaultValue;
    return `${numValue.toFixed(1)}%`;
};

// Estilos Neumórficos e Cores (Reutilizados de Metrics/Index)
const neonColor = "#1E90FF";
const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]";
const baseLabelStyle = "text-xs text-gray-400 mb-1 block";
const baseTitleStyle = "text-lg font-semibold text-white";
const axisTickColor = "#a0aec0"; // Para gráficos Recharts

interface BudgetStatCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    iconColor?: string;
    isLoading?: boolean;
}

const BudgetStatCard: React.FC<BudgetStatCardProps> = ({ icon: Icon, label, value, subValue, iconColor = neonColor, isLoading }) => (
    <div className={cn(cardStyle, "p-4 flex flex-col")}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300" style={{ textShadow: `0 0 3px ${iconColor}50` }}>{label}</span>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : <Icon className="h-5 w-5" style={{ color: iconColor, filter: `drop-shadow(0 0 3px ${iconColor})` }} />}
        </div>
        <p className="text-2xl font-bold text-white mb-1" style={{ textShadow: `0 0 5px ${iconColor}70` }}>{isLoading ? "..." : value}</p>
        {subValue && <p className="text-xs text-gray-400">{isLoading ? "..." : subValue}</p>}
    </div>
);

const costColors = { // Cores para o gráfico de pizza e lista de custos
    traffic: '#3b82f6',    // Azul
    creative: '#22c55e',  // Verde
    operational: '#eab308', // Amarelo
    unallocated: '#6b7280' // Cinza
};

export default function BudgetPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), DEFAULT_PERIOD_DAYS - 1),
        to: new Date(),
    });

    const loadBudgetData = useCallback(async () => {
        if (!isAuthenticated || !dateRange?.from || !dateRange?.to) return;
        setIsLoading(true); setError(null); setBudgetData(null);
        try {
            const response = await axios.get<BudgetData>('/api/budget', {
                params: {
                    startDate: format(dateRange.from, DATE_FORMAT_API),
                    endDate: format(dateRange.to, DATE_FORMAT_API),
                    campaignId: selectedCampaignId || 'all',
                }
            });
            // Adicionar cores aos dados do gráfico de pizza se eles vierem da API
            const dataWithColors = response.data;
            if (dataWithColors.pieChartData) {
                dataWithColors.pieChartData = dataWithColors.pieChartData.map(item => {
                    if (item.name.toLowerCase().includes('tráfego')) return {...item, color: costColors.traffic};
                    if (item.name.toLowerCase().includes('criativo')) return {...item, color: costColors.creative};
                    if (item.name.toLowerCase().includes('operacional')) return {...item, color: costColors.operational};
                    return {...item, color: costColors.unallocated}; // Default para Não Alocado ou outros
                });
            }
            setBudgetData(dataWithColors);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Falha ao buscar dados de orçamento.";
            setError(msg);
            toast({ title: "Erro", description: msg, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, dateRange, selectedCampaignId, toast]);

    const fetchCampaignOptions = useCallback(async () => {
        setIsLoadingCampaigns(true);
        try {
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name&sort=name:asc');
            setCampaignOptions(response.data || []);
        } catch (err: any) {
            toast({ title: "Erro", description: "Falha ao carregar campanhas.", variant: "destructive" });
        } finally {
            setIsLoadingCampaigns(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
        else if (!authLoading && isAuthenticated) fetchCampaignOptions();
    }, [authLoading, isAuthenticated, router, fetchCampaignOptions]);

    useEffect(() => {
        if (isAuthenticated && !isLoadingCampaigns && dateRange?.from && dateRange?.to) {
            loadBudgetData();
        }
    }, [isAuthenticated, isLoadingCampaigns, selectedCampaignId, dateRange, loadBudgetData]);

    if (authLoading) {
        return <Layout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: neonColor, filter: `drop-shadow(0 0 4px ${neonColor})`}}/></div></Layout>;
    }
    if (!isAuthenticated) return null;

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value, color }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const percentage = (percent * 100).toFixed(0);

        if (parseFloat(percentage) < 5) return null; // Não renderizar labels para fatias muito pequenas

        return (
            <text x={x} y={y} fill={color === '#000000' ? '#FFFFFF' : '#FFFFFF'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px" fontWeight="bold" style={{filter: `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 3px rgba(0,0,0,0.7))`}}>
                {`${name} (${percentage}%)`}
            </text>
        );
    };

    return (
        <Layout>
            <Head><title>Análise de Orçamento - USBMKT</title></Head>
            <div className="p-4 md:p-6 space-y-6 h-full flex flex-col text-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 flex-shrink-0">
                    <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>Análise de Orçamento</h1>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal h-9 px-3 text-xs", neumorphicInputStyle, !dateRange && "text-muted-foreground")} disabled={isLoading || isLoadingCampaigns}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "P", { locale: ptBR })} - {format(dateRange.to, "P", { locale: ptBR })}</>) : format(dateRange.from, "P", { locale: ptBR })) : (<span>Selecione</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-[#1e2128] border-[#1E90FF]/30" align="end">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} disabled={isLoading || isLoadingCampaigns} className="text-white [&>div>table>tbody>tr>td>button]:text-white [&>div>table>tbody>tr>td>button]:border-[#1E90FF]/20 [&>div>table>thead>tr>th]:text-gray-400 [&>div>div>button]:text-white [&>div>div>button:hover]:bg-[#1E90FF]/20 [&>div>div>div]:text-white" />
                            </PopoverContent>
                        </Popover>
                        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={isLoadingCampaigns || isLoading}>
                            <SelectTrigger className={cn("w-full sm:w-auto sm:min-w-[180px] h-9 px-3 text-xs", neumorphicInputStyle)}>
                                <SelectValue placeholder="Campanha" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                <SelectItem value="all" className="text-xs hover:!bg-[#1E90FF]/20 focus:!bg-[#1E90FF]/20">Todas Campanhas</SelectItem>
                                {isLoadingCampaigns && <div className="p-2 text-xs text-center text-slate-400">Carregando...</div>}
                                {!isLoadingCampaigns && campaignOptions.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()} className="text-xs hover:!bg-[#1E90FF]/20 focus:!bg-[#1E90FF]/20">{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 className="h-10 w-10 animate-spin" style={{ color: neonColor, filter: `drop-shadow(0 0 5px ${neonColor})`}}/></div>
                    ) : error ? (
                        <Card className={cn(cardStyle, "h-full flex flex-col items-center justify-center p-6 text-center")}>
                            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" style={{ filter: `drop-shadow(0 0 5px ${neonColor})`}}/>
                            <CardTitle className="text-lg text-red-400 mb-2" style={{ textShadow: `0 0 5px ${neonColor}70`}}>Erro ao Carregar Dados</CardTitle>
                            <CardContent className="p-0"><p className="text-sm text-slate-400">{error}</p></CardContent>
                        </Card>
                    ) : !budgetData ? (
                        <Card className={cn(cardStyle, "h-full flex flex-col items-center justify-center p-6 text-center")}>
                             <Info className="w-12 h-12 text-slate-500 mb-4" style={{ filter: `drop-shadow(0 0 5px ${neonColor})`}}/>
                             <CardTitle className="text-lg text-slate-400 mb-2" style={{ textShadow: `0 0 5px ${neonColor}70`}}>Sem Dados Disponíveis</CardTitle>
                             <CardContent className="p-0"><p className="text-sm text-slate-500">Não há dados de orçamento para o período ou campanha selecionada.</p></CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2 space-y-6">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader><CardTitle className="text-xl font-semibold" style={{color: neonColor, textShadow: `0 0 6px ${neonColor}A0`}}>Sumário Financeiro</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                                        <BudgetStatCard icon={Coins} label="Orçamento Total" value={budgetData.totalBudgetFmt ?? 'N/A'} isLoading={isLoading} iconColor="#3b82f6"/>
                                        <BudgetStatCard icon={DollarSign} label="Gasto Real" value={budgetData.totalRealCostFmt ?? 'N/A'} subValue={formatPercent(budgetData.budgetUsedPerc)} isLoading={isLoading} iconColor="#f59e0b"/>
                                        <BudgetStatCard icon={TrendingUp} label="Receita Total" value={budgetData.totalRevenueFmt ?? 'N/A'} isLoading={isLoading} iconColor="#10b981"/>
                                        <BudgetStatCard icon={DollarSign} label="Lucro Real" value={budgetData.realProfitFmt ?? 'N/A'} isLoading={isLoading} iconColor="#22c55e"/>
                                        <BudgetStatCard icon={Percent} label="Margem de Lucro" value={formatPercent(budgetData.realProfitMargin)} isLoading={isLoading} iconColor="#14b8a6"/>
                                        <BudgetStatCard icon={Minus} label="Saldo Orçamento" value={budgetData.budgetRemainingFmt ?? 'N/A'} isLoading={isLoading} iconColor="#64748b"/>
                                    </CardContent>
                                </Card>

                                <Card className={cn(cardStyle, "p-4")}>
                                    <CardHeader className="p-2 text-center mb-2">
                                        <CardTitle className="text-xl font-semibold" style={{color: neonColor, textShadow: `0 0 6px ${neonColor}A0`}}>Distribuição de Custos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 w-full flex items-center justify-center min-h-[300px] sm:min-h-[400px] bg-[#0D0D0D]/50 rounded-md border border-slate-700/50">
                                        {budgetData.pieChartData && budgetData.pieChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={400}>
                                                <PieChart>
                                                    <Pie
                                                        data={budgetData.pieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={renderCustomizedLabel}
                                                        outerRadius={120}
                                                        innerRadius={60} // Para Donut
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                        paddingAngle={3}
                                                        stroke="none"
                                                    >
                                                        {budgetData.pieChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} style={{filter: `drop-shadow(0 0 5px ${entry.color})`}}/>
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.85)', border: `1px solid ${neonColor}66`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)'}}
                                                        labelStyle={{ color: '#a0aec0', fontSize: '11px', marginBottom: '4px' }}
                                                        itemStyle={{ color: 'white', fontSize: '11px' }}
                                                        formatter={(value: number, name: string, props: {payload: PieChartDataItem}) => [`${formatCurrency(value)} (${(props.payload.value / (budgetData.totalBudget || 1) * 100).toFixed(1)}%)`, name]}
                                                    />
                                                    <Legend wrapperStyle={{ color: axisTickColor, fontSize: '11px', paddingTop: '15px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : budgetData.chartImageUrl ? ( // Fallback para imagem se pieChartData não estiver disponível
                                            <Image src={budgetData.chartImageUrl} alt="Gráfico Distribuição de Custos" width={500} height={350} className="object-contain" priority={true} />
                                        ) : (
                                            <div className="text-center text-slate-500 p-6">
                                                <PieChartIconLucide className="w-16 h-16 mx-auto mb-3 text-slate-600" />
                                                <p className="text-sm">Gráfico de distribuição indisponível.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="xl:col-span-1 space-y-6">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader><CardTitle className="text-xl font-semibold" style={{color: neonColor, textShadow: `0 0 6px ${neonColor}A0`}}>Custos Detalhados</CardTitle></CardHeader>
                                    <CardContent className="space-y-3 pt-3">
                                        {[
                                            { label: "Tráfego", value: budgetData.trafficCostFmt, perc: budgetData.trafficPerc, icon: Coins, color: costColors.traffic },
                                            { label: "Criativos", value: budgetData.creativeCostFmt, perc: budgetData.creativePerc, icon: Target, color: costColors.creative },
                                            { label: "Operacional", value: budgetData.operationalCostFmt, perc: budgetData.opPerc, icon: Scale, color: costColors.operational }
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center justify-between p-3 bg-[#0D0D0D]/40 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-6 h-6 flex-shrink-0" style={{color: item.color, filter: `drop-shadow(0 0 3px ${item.color})`}}/>
                                                    <span className="text-sm text-slate-100 font-medium">{item.label}</span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-bold text-white" style={{ textShadow: `0 0 4px ${item.color}70`}}>{item.value ?? 'R$ 0,00'}</p>
                                                    <p className="text-xs text-slate-400">{formatPercent(item.perc)} do total</p>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between border-t border-slate-700 pt-4 mt-4">
                                            <div className="flex items-center gap-3"><Sigma className="w-5 h-5 text-slate-400"/> <span className="text-sm font-semibold text-slate-100">Total Alocado</span></div>
                                            <p className="text-base font-bold text-white">{formatCurrency((budgetData.trafficCost ?? 0) + (budgetData.creativeCost ?? 0) + (budgetData.operationalCost ?? 0))}</p>
                                        </div>
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-3"><Minus className="w-5 h-5 text-slate-500"/> <span className="text-sm text-slate-300">Não Alocado</span></div>
                                            <div className="text-right">
                                                <p className="text-base font-semibold text-white">{budgetData.unallocatedFmt ?? 'R$ 0,00'}</p>
                                                <p className="text-xs text-slate-400">{formatPercent(budgetData.unallocatedPerc)} do total</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
