// components/CampaignManagerForm.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarIcon, DollarSign, Link2, Percent, Briefcase, Megaphone, Users } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";

export interface ClientAccountOption {
  id: string;
  name: string;
  platform: 'google' | 'meta' | 'tiktok' | 'manual' | string;
  platformAccountId: string;
}

export interface CampaignFormData {
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

interface CampaignManagerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CampaignFormData>) => Promise<void>;
  campaignData?: Partial<CampaignFormData> | null;
  availableClientAccounts: ClientAccountOption[];
}

const initialFormData: CampaignFormData = {
  name: '',
  status: 'draft',
  selectedClientAccountId: '', 
  platform: [],
  objective: [],
  ad_format: [],
  budget: '',
  daily_budget: '',
  start_date: null,
  end_date: null,
  target_audience_description: '',
  industry: '',
  segmentation_notes: '',
  avg_ticket: '',
  external_campaign_id: '',
};

const cardStyle = "bg-[#10121a]/90 backdrop-blur-md border border-[#1E90FF]/20 shadow-xl";
const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-1 focus:ring-[#1E90FF] h-9";
const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98]";
const primaryButtonStyle = `bg-gradient-to-r from-[#1E90FF] to-[#4682B4] hover:from-[#4682B4] hover:to-[#4682B4] text-white font-semibold`;
const labelStyle = "text-xs text-gray-300 font-medium mb-1 block";
const sectionTitleStyle = "text-sm font-semibold text-white flex items-center gap-2 hover:no-underline p-3 rounded-md bg-[#141414]/60 hover:bg-[#1E90FF]/10 transition-all";
const selectContentStyle = "bg-[#1e2128] border-[#1E90FF]/30 text-white";

const PLATFORM_OPTIONS = [{value: 'google', label: 'Google Ads'}, {value: 'meta', label: 'Meta Ads'}, {value: 'tiktok', label: 'TikTok Ads'}, {value: 'linkedin', label: 'LinkedIn Ads'}, {value: 'manual', label: 'Manual/Outra'}];
const OBJECTIVE_OPTIONS = [{value: 'vendas', label: 'Vendas'}, {value: 'leads', label: 'Leads'}, {value: 'trafego', label: 'Tráfego Site'}, {value: 'reconhecimento', label: 'Reconhecimento'}, {value: 'engajamento', label: 'Engajamento'}];
const AD_FORMAT_OPTIONS = [{value: 'imagem', label: 'Imagem'}, {value: 'video', label: 'Vídeo'}, {value: 'carrossel', label: 'Carrossel'}, {value: 'texto', label: 'Anúncio Texto'}, {value: 'stories', label: 'Stories'}];
const STATUS_OPTIONS_FORM = [{value: 'draft', label: 'Rascunho'}, {value: 'active', label: 'Ativa'}, {value: 'paused', label: 'Pausada'}, {value: 'completed', label: 'Concluída'}, {value: 'archived', label: 'Arquivada'}];

export default function CampaignManagerForm({
  isOpen,
  onClose,
  onSave,
  campaignData,
  availableClientAccounts,
}: CampaignManagerFormProps) {
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // console.log('[CampaignManagerForm] useEffect campaignData:', campaignData, 'isOpen:', isOpen); // DEBUG
    // console.log('[CampaignManagerForm] useEffect availableClientAccounts:', availableClientAccounts, Array.isArray(availableClientAccounts)); // DEBUG
    if (isOpen) {
      if (campaignData) {
        setFormData({
          id: campaignData.id || null,
          name: campaignData.name || '',
          status: campaignData.status || 'draft',
          selectedClientAccountId: campaignData.selectedClientAccountId || '',
          platform: Array.isArray(campaignData.platform) ? campaignData.platform : [],
          objective: Array.isArray(campaignData.objective) ? campaignData.objective : [],
          ad_format: Array.isArray(campaignData.ad_format) ? campaignData.ad_format : [],
          budget: campaignData.budget || '',
          daily_budget: campaignData.daily_budget || '',
          start_date: campaignData.start_date ? (isValid(campaignData.start_date) ? campaignData.start_date : (isValid(parseISO(String(campaignData.start_date))) ? parseISO(String(campaignData.start_date)) : null)) : null,
          end_date: campaignData.end_date ? (isValid(campaignData.end_date) ? campaignData.end_date : (isValid(parseISO(String(campaignData.end_date))) ? parseISO(String(campaignData.end_date)) : null)) : null,
          target_audience_description: campaignData.target_audience_description || '',
          industry: campaignData.industry || '',
          segmentation_notes: campaignData.segmentation_notes || '',
          avg_ticket: campaignData.avg_ticket || '',
          external_campaign_id: campaignData.external_campaign_id || '',
        });
      } else {
        setFormData(initialFormData);
      }
    }
  }, [campaignData, isOpen]);

  const handleChange = (field: keyof CampaignFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleMultiSelectChange = (field: 'platform' | 'objective' | 'ad_format', value: string) => {
    setFormData(prev => {
        const currentValues = prev[field] as string[] || [];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
        return { ...prev, [field]: newValues };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selectedClientAccountId) {
        toast({ title: "Campo Obrigatório", description: "Por favor, selecione uma Conta de Cliente Vinculada.", variant: "destructive"});
        return;
    }
    if (formData.platform.length === 0) {
        toast({ title: "Campo Obrigatório", description: "Selecione ao menos uma Plataforma de Anúncio.", variant: "destructive"});
        return;
    }
    if (!formData.name.trim()) {
        toast({ title: "Campo Obrigatório", description: "O Nome da Campanha é obrigatório.", variant: "destructive"});
        return;
    }

    setIsLoading(true);
    const dataToSave = {
      ...formData,
      budget: formData.budget ? parseFloat(String(formData.budget)) : null,
      daily_budget: formData.daily_budget ? parseFloat(String(formData.daily_budget)) : null,
      avg_ticket: formData.avg_ticket ? parseFloat(String(formData.avg_ticket)) : null,
    };
    await onSave(dataToSave);
    setIsLoading(false);
  };
  
  const renderMultiSelectButtons = (
    options: { value: string; label: string }[],
    field: 'platform' | 'objective' | 'ad_format'
  ) => (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {options.map(opt => (
        <Button
          key={opt.value}
          type="button"
          variant={(formData[field] as string[]).includes(opt.value) ? "default" : "outline"}
          onClick={() => handleMultiSelectChange(field, opt.value)}
          className={cn(
            neumorphicButtonStyle, "text-xs h-8 px-3",
            (formData[field] as string[]).includes(opt.value) ? primaryButtonStyle : "bg-[#0e1015] hover:bg-[#1E90FF]/20"
          )}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(cardStyle, "max-w-3xl md:max-w-4xl p-0 border-none")}>
        <DialogHeader className="p-4 border-b border-[#1E90FF]/20">
          <DialogTitle className="text-lg font-semibold text-white">
            {campaignData?.id ? 'Editar Campanha de Tráfego' : 'Nova Campanha de Tráfego'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Preencha os detalhes para {campaignData?.id ? 'atualizar a' : 'criar uma nova'} campanha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="p-4 space-y-1">
              <Accordion type="multiple" defaultValue={["infoPrincipais", "plataformaObjetivosFormatos", "orcamentoDatas"]} className="w-full">
                
                <AccordionItem value="infoPrincipais" className="border-none mb-2">
                  <AccordionTrigger className={sectionTitleStyle}><Briefcase className="h-4 w-4 mr-2 text-[#1E90FF]" /> Vinculação & Informações Gerais</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label htmlFor="clientAccount" className={labelStyle}>Conta de Cliente Vinculada *</Label>
                            <Select value={formData.selectedClientAccountId || ''} onValueChange={(value) => handleChange('selectedClientAccountId', value)} required>
                                <SelectTrigger id="clientAccount" className={neumorphicInputStyle}><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                <SelectContent className={selectContentStyle}>
                                    {/* DEBUG LOG: console.log('[Form Select] availableClientAccounts:', availableClientAccounts, Array.isArray(availableClientAccounts)) */}
                                    {(!Array.isArray(availableClientAccounts) || availableClientAccounts.length === 0) && <SelectItem value="" disabled>Nenhuma conta carregada</SelectItem>}
                                    {Array.isArray(availableClientAccounts) && availableClientAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.platform.toUpperCase()})</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="name" className={labelStyle}>Nome da Campanha *</Label>
                            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Ex: Lançamento Black Friday - Cliente X" className={neumorphicInputStyle} required />
                        </div>
                        <div>
                            <Label htmlFor="status" className={labelStyle}>Status *</Label>
                            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)} required>
                                <SelectTrigger id="status" className={neumorphicInputStyle}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent className={selectContentStyle}>{STATUS_OPTIONS_FORM.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                         <div>
                            <Label htmlFor="industry" className={labelStyle}>Indústria/Nicho</Label>
                            <Input id="industry" value={formData.industry || ''} onChange={(e) => handleChange('industry', e.target.value)} placeholder="Ex: E-commerce de Moda" className={neumorphicInputStyle} />
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="plataformaObjetivosFormatos" className="border-none mb-2">
                  <AccordionTrigger className={sectionTitleStyle}><Megaphone className="h-4 w-4 mr-2 text-[#1E90FF]" /> Plataformas, Objetivos & Formatos</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                     <div className="p-4 space-y-4 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label className={labelStyle}>Plataforma(s) de Anúncio *</Label>
                            {renderMultiSelectButtons(PLATFORM_OPTIONS, 'platform')}
                            {formData.platform.length === 0 && <p className="text-xs text-red-400 mt-1">Selecione ao menos uma plataforma.</p>}
                        </div>
                        <div>
                            <Label className={labelStyle}>Objetivo(s) Principal(is)</Label>
                            {renderMultiSelectButtons(OBJECTIVE_OPTIONS, 'objective')}
                        </div>
                         <div>
                            <Label className={labelStyle}>Formato(s) de Anúncio</Label>
                            {renderMultiSelectButtons(AD_FORMAT_OPTIONS, 'ad_format')}
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="orcamentoDatas" className="border-none mb-2">
                  <AccordionTrigger className={sectionTitleStyle}><DollarSign className="h-4 w-4 mr-2 text-[#1E90FF]" /> Orçamento & Agendamento</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label htmlFor="daily_budget" className={labelStyle}>Orçamento Diário (R$)</Label>
                            <Input id="daily_budget" type="number" step="0.01" min="0" value={String(formData.daily_budget || '')} onChange={(e) => handleChange('daily_budget', e.target.value)} placeholder="Ex: 50.00" className={neumorphicInputStyle} />
                        </div>
                        <div>
                            <Label htmlFor="budget" className={labelStyle}>Orçamento Total (R$) (Opcional)</Label>
                            <Input id="budget" type="number" step="0.01" min="0" value={String(formData.budget || '')} onChange={(e) => handleChange('budget', e.target.value)} placeholder="Ex: 1500.00" className={neumorphicInputStyle} />
                        </div>
                        <div>
                            <Label htmlFor="start_date" className={labelStyle}>Data de Início</Label>
                            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn(neumorphicInputStyle, "w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.start_date ? format(formData.start_date, 'dd/MM/yyyy', { locale: ptBR }) : <span>Selecione...</span>}</Button></PopoverTrigger><PopoverContent className={cn(selectContentStyle, "w-auto p-0")}><Calendar mode="single" selected={formData.start_date || undefined} onSelect={(date) => handleChange('start_date', date || null)} initialFocus locale={ptBR} /></PopoverContent></Popover>
                        </div>
                        <div>
                            <Label htmlFor="end_date" className={labelStyle}>Data de Término (Opcional)</Label>
                            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn(neumorphicInputStyle, "w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.end_date ? format(formData.end_date, 'dd/MM/yyyy', { locale: ptBR }) : <span>Selecione...</span>}</Button></PopoverTrigger><PopoverContent className={cn(selectContentStyle, "w-auto p-0")}><Calendar mode="single" selected={formData.end_date || undefined} onSelect={(date) => handleChange('end_date', date || null)} initialFocus locale={ptBR} /></PopoverContent></Popover>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="publicoSegmentacao" className="border-none mb-2">
                  <AccordionTrigger className={sectionTitleStyle}><Users className="h-4 w-4 mr-2 text-[#1E90FF]" /> Público & Segmentação</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                     <div className="p-4 space-y-3 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label htmlFor="target_audience_description" className={labelStyle}>Descrição do Público-Alvo</Label>
                            <Textarea id="target_audience_description" value={formData.target_audience_description || ''} onChange={(e) => handleChange('target_audience_description', e.target.value)} placeholder="Descreva as características demográficas, interesses, comportamentos..." className={cn(neumorphicInputStyle, "min-h-[80px]")} />
                        </div>
                        <div>
                            <Label htmlFor="segmentation_notes" className={labelStyle}>Notas Adicionais de Segmentação</Label>
                            <Textarea id="segmentation_notes" value={formData.segmentation_notes || ''} onChange={(e) => handleChange('segmentation_notes', e.target.value)} placeholder="Detalhes sobre geolocalização, dispositivos, exclusões, etc." className={cn(neumorphicInputStyle, "min-h-[60px]")} />
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="identificacaoExterna" className="border-none mb-2">
                  <AccordionTrigger className={sectionTitleStyle}><Link2 className="h-4 w-4 mr-2 text-[#1E90FF]" /> Identificação Externa (Opcional)</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                     <div className="p-4 space-y-3 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label htmlFor="external_campaign_id" className={labelStyle}>ID da Campanha na Plataforma</Label>
                            <Input id="external_campaign_id" value={formData.external_campaign_id || ''} onChange={(e) => handleChange('external_campaign_id', e.target.value)} placeholder="Cole o ID da campanha (ex: do Google Ads, Meta Ads)" className={neumorphicInputStyle} />
                             <p className="text-xs text-gray-500 mt-1">Use para vincular a uma campanha já existente na plataforma de anúncios.</p>
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="metricasNegocio" className="border-none">
                  <AccordionTrigger className={sectionTitleStyle}><Percent className="h-4 w-4 mr-2 text-[#1E90FF]" /> Métricas de Negócio (Opcional)</AccordionTrigger>
                  <AccordionContent className="pt-2 px-0.5 pb-0.5">
                     <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-[#0A0B0F]/30 rounded-md border border-transparent hover:border-[#1E90FF]/20 transition-colors">
                        <div>
                            <Label htmlFor="avg_ticket" className={labelStyle}>Ticket Médio Estimado (R$)</Label>
                            <Input id="avg_ticket" type="number" step="0.01" min="0" value={String(formData.avg_ticket || '')} onChange={(e) => handleChange('avg_ticket', e.target.value)} placeholder="Ex: 197.00" className={neumorphicInputStyle} />
                        </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 border-t border-[#1E90FF]/20 gap-2 flex-wrap justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} disabled={isLoading}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" className={cn(primaryButtonStyle, "h-8 px-4 text-xs")} disabled={isLoading || !formData.selectedClientAccountId || formData.platform.length === 0 || !formData.name.trim()}>
              {isLoading ? 'Salvando...' : (campaignData?.id ? 'Salvar Alterações' : 'Criar Campanha')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
