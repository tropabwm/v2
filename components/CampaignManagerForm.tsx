// components/CampaignManagerForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils'; // Importar a função cn

// Definir as interfaces aqui para serem exportadas e usadas em campaign-manager.tsx
export interface ClientAccountOption {
  id: string;
  name: string;
  // NOVAS PROPRIEDADES ADICIONADAS AQUI
  platform: string;
  platformAccountId: string;
}

export interface CampaignFormData {
  id?: string; // Opcional para novas campanhas
  name: string;
  status: string;
  selectedClientAccountId: string;
  platform: string[];
  objective: string[];
  ad_format: string[];
  budget: number;
  daily_budget: number;
  start_date?: Date; // Pode ser undefined para novas campanhas ou se não selecionado
  end_date?: Date;   // Pode ser undefined
  target_audience_description: string;
  industry: string;
  segmentation_notes: string;
  avg_ticket: number;
  external_campaign_id: string;
  platform_source: string; // Adicionado
  external_platform_account_id: string; // Adicionado
}

interface CampaignManagerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CampaignFormData) => void;
  campaignData: CampaignFormData | null; // Dados para edição
  availableClientAccounts: ClientAccountOption[];
}

const initialFormData: CampaignFormData = {
  name: '',
  status: 'draft',
  selectedClientAccountId: '',
  platform: [],
  objective: [],
  ad_format: [],
  budget: 0,
  daily_budget: 0,
  start_date: undefined,
  end_date: undefined,
  target_audience_description: '',
  industry: '',
  segmentation_notes: '',
  avg_ticket: 0,
  external_campaign_id: '',
  platform_source: '', // Inicializar com string vazia
  external_platform_account_id: '', // Inicializar com string vazia
};

const CampaignManagerForm: React.FC<CampaignManagerFormProps> = ({
  isOpen,
  onClose,
  onSave,
  campaignData,
  availableClientAccounts,
}) => {
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setFormData(campaignData || initialFormData);
    }
  }, [isOpen, campaignData]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectChange = useCallback((name: keyof CampaignFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleMultiSelectChange = useCallback((name: keyof CampaignFormData, value: string) => {
    setFormData((prev) => {
      const currentArray = (prev[name] as string[]) || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value];
      return { ...prev, [name]: newArray };
    });
  }, []);

  const handleDateChange = useCallback((name: 'start_date' | 'end_date', date?: Date) => {
    setFormData((prev) => ({ ...prev, [name]: date }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.name.trim()) {
      toast({
        title: 'Erro de Validação',
        description: 'O campo "Nome" é obrigatório.',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.selectedClientAccountId) {
      toast({
        title: 'Erro de Validação',
        description: 'Selecione uma "Conta de Cliente".',
        variant: 'destructive',
      });
      return;
    }
    if (formData.platform.length === 0) {
      toast({
        title: 'Erro de Validação',
        description: 'Selecione ao menos uma "Plataforma".',
        variant: 'destructive',
      });
      return;
    }
    if (formData.objective.length === 0) {
      toast({
        title: 'Erro de Validação',
        description: 'Selecione ao menos um "Objetivo".',
        variant: 'destructive',
      });
      return;
    }
    if (formData.ad_format.length === 0) {
      toast({
        title: 'Erro de Validação',
        description: 'Selecione ao menos um "Formato de Anúncio".',
        variant: 'destructive',
      });
      return;
    }

    // Convertendo orçamentos para número (se não forem já)
    const dataToSave = {
      ...formData,
      budget: Number(formData.budget),
      daily_budget: Number(formData.daily_budget),
      avg_ticket: Number(formData.avg_ticket),
    };

    onSave(dataToSave);
  };

  const platforms = ['Google Ads', 'Meta Ads', 'TikTok Ads', 'LinkedIn Ads', 'Outra'];
  const objectives = ['Vendas', 'Leads', 'Tráfego', 'Engajamento', 'Reconhecimento de Marca', 'Outro'];
  const adFormats = ['Imagem', 'Vídeo', 'Carrossel', 'Texto', 'Coleção', 'Outro'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-[#1a1c23] border border-[#2a2d34] text-gray-100 shadow-neumorphic-outer-dark">
        <DialogHeader>
          <DialogTitle className="text-gray-50">{campaignData ? 'Editar Campanha' : 'Criar Nova Campanha'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-160px)] pr-4"> {/* Ajuste a altura conforme necessário */}
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3", "item-4", "item-5"]}>
              {/* Seção 1: Informações Gerais */}
              <AccordionItem value="item-1" className="border-b border-[#2a2d34]">
                <AccordionTrigger className="text-gray-50 hover:no-underline text-base">Informações Gerais</AccordionTrigger>
                <AccordionContent className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-gray-300">Nome</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right text-gray-300">Status</Label>
                    <Select name="status" value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                      <SelectTrigger className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue">
                        <SelectValue placeholder="Selecione o Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="archived">Arquivada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="selectedClientAccountId" className="text-right text-gray-300">Conta de Cliente</Label>
                    <Select name="selectedClientAccountId" value={formData.selectedClientAccountId} onValueChange={(val) => handleSelectChange('selectedClientAccountId', val)}>
                      {/* REMOVIDA A PROP 'required' */}
                      <SelectTrigger className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue">
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                        {availableClientAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="industry" className="text-right text-gray-300">Indústria</Label>
                    <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="Ex: Varejo" className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Seção 2: Plataformas, Objetivos e Formatos de Anúncio */}
              <AccordionItem value="item-2" className="border-b border-[#2a2d34]">
                <AccordionTrigger className="text-gray-50 hover:no-underline text-base">Plataformas, Objetivos & Formatos</AccordionTrigger>
                <AccordionContent className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right text-gray-300">Plataforma(s)</Label>
                    <div className="col-span-3 flex flex-wrap gap-2">
                      {platforms.map((p) => (
                        <Button
                          key={p}
                          type="button"
                          variant={formData.platform.includes(p) ? 'default' : 'outline'}
                          onClick={() => handleMultiSelectChange('platform', p)}
                          className={cn(
                            "transition-all duration-200",
                            formData.platform.includes(p)
                              ? "bg-neon-blue hover:bg-neon-blue-muted text-white shadow-lg neumorphic-neon-outset-glow"
                              : "bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] hover:text-gray-50"
                          )}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right text-gray-300">Objetivo(s)</Label>
                    <div className="col-span-3 flex flex-wrap gap-2">
                      {objectives.map((o) => (
                        <Button
                          key={o}
                          type="button"
                          variant={formData.objective.includes(o) ? 'default' : 'outline'}
                          onClick={() => handleMultiSelectChange('objective', o)}
                          className={cn(
                            "transition-all duration-200",
                            formData.objective.includes(o)
                              ? "bg-neon-blue hover:bg-neon-blue-muted text-white shadow-lg neumorphic-neon-outset-glow"
                              : "bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] hover:text-gray-50"
                          )}
                        >
                          {o}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right text-gray-300">Formato(s) de Anúncio</Label>
                    <div className="col-span-3 flex flex-wrap gap-2">
                      {adFormats.map((af) => (
                        <Button
                          key={af}
                          type="button"
                          variant={formData.ad_format.includes(af) ? 'default' : 'outline'}
                          onClick={() => handleMultiSelectChange('ad_format', af)}
                          className={cn(
                            "transition-all duration-200",
                            formData.ad_format.includes(af)
                              ? "bg-neon-blue hover:bg-neon-blue-muted text-white shadow-lg neumorphic-neon-outset-glow"
                              : "bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] hover:text-gray-50"
                          )}
                        >
                          {af}
                        </Button>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Seção 3: Orçamento e Agendamento */}
              <AccordionItem value="item-3" className="border-b border-[#2a2d34]">
                <AccordionTrigger className="text-gray-50 hover:no-underline text-base">Orçamento & Agendamento</AccordionTrigger>
                <AccordionContent className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="budget" className="text-right text-gray-300">Orçamento Total</Label>
                    <Input id="budget" name="budget" type="number" value={formData.budget} onChange={handleChange} className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="daily_budget" className="text-right text-gray-300">Orçamento Diário</Label>
                    <Input id="daily_budget" name="daily_budget" type="number" value={formData.daily_budget} onChange={handleChange} className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="start_date" className="text-right text-gray-300">Data de Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] focus-visible:ring-neon-blue",
                            !formData.start_date && "text-gray-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.start_date ? format(formData.start_date, "PPP") : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                        <Calendar
                          mode="single"
                          selected={formData.start_date}
                          onSelect={(date) => handleDateChange('start_date', date)}
                          initialFocus
                          className="text-gray-100"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="end_date" className="text-right text-gray-300">Data de Término</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "col-span-3 justify-start text-left font-normal bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] focus-visible:ring-neon-blue",
                            !formData.end_date && "text-gray-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, "PPP") : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#2a2d34] border border-[#3a3d44] text-gray-100">
                        <Calendar
                          mode="single"
                          selected={formData.end_date}
                          onSelect={(date) => handleDateChange('end_date', date)}
                          initialFocus
                          className="text-gray-100"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Seção 4: Público e Segmentação */}
              <AccordionItem value="item-4" className="border-b border-[#2a2d34]">
                <AccordionTrigger className="text-gray-50 hover:no-underline text-base">Público & Segmentação</AccordionTrigger>
                <AccordionContent className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="target_audience_description" className="text-right text-gray-300">Público-Alvo</Label>
                    <Textarea id="target_audience_description" name="target_audience_description" value={formData.target_audience_description} onChange={handleChange} placeholder="Descreva..." className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="segmentation_notes" className="text-right text-gray-300">Notas de Segmentação</Label>
                    <Textarea id="segmentation_notes" name="segmentation_notes" value={formData.segmentation_notes} onChange={handleChange} placeholder="Ex: Idade, Gênero, Interesses..." className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Seção 5: Identificação Externa e Métricas de Negócio */}
              <AccordionItem value="item-5" className="border-b border-[#2a2d34]">
                <AccordionTrigger className="text-gray-50 hover:no-underline text-base">Identificação Externa & Métricas de Negócio</AccordionTrigger>
                <AccordionContent className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="external_campaign_id" className="text-right text-gray-300">ID da Campanha Externa</Label>
                    <Input id="external_campaign_id" name="external_campaign_id" value={formData.external_campaign_id} onChange={handleChange} placeholder="ID da campanha na plataforma de anúncios" className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="platform_source" className="text-right text-gray-300">Fonte da Plataforma</Label>
                    <Input id="platform_source" name="platform_source" value={formData.platform_source} onChange={handleChange} placeholder="Ex: Google Ads, Meta Ads" className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="external_platform_account_id" className="text-right text-gray-300">ID da Conta Externa</Label>
                    <Input id="external_platform_account_id" name="external_platform_account_id" value={formData.external_platform_account_id} onChange={handleChange} placeholder="ID da conta na plataforma de anúncios" className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="avg_ticket" className="text-right text-gray-300">Ticket Médio</Label>
                    <Input id="avg_ticket" name="avg_ticket" type="number" value={formData.avg_ticket} onChange={handleChange} className="col-span-3 bg-[#2a2d34] border border-[#3a3d44] text-gray-100 focus-visible:ring-neon-blue" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </form>
        </ScrollArea>
        <DialogFooter className="bg-[#1a1c23] pt-4 -mx-6 -mb-6 px-6 border-t border-[#2a2d34]">
          <Button type="button" variant="outline" onClick={onClose} className="bg-[#2a2d34] border border-[#3a3d44] text-gray-100 hover:bg-[#3a3d44] hover:text-gray-50">
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSubmit} className="bg-neon-blue hover:bg-neon-blue-muted text-white shadow-lg transition-all duration-300 ease-in-out hover:neumorphic-neon-outset-glow">
            {campaignData ? 'Salvar Alterações' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignManagerForm;
