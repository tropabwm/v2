//components/CampaignManagerForm.tsx
import React,{ useState,useEffect }from 'react';
import { Dialog, DialogContent, DialogHeader,DialogTitle, DialogDescription, DialogFooter,DialogClose} from "@/components/ui/dialog";
import{Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import{ Button} from "@/components/ui/button";
import { Input} from "@/components/ui/input";
import { Label} from "@/components/ui/label";
import { Select, SelectContent,SelectItem, SelectTrigger,SelectValue} from "@/components/ui/select";
import{Textarea} from "@/components/ui/textarea";
import{ Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import{Calendar} from "@/components/ui/calendar";
import {ScrollArea} from "@/components/ui/scroll-area";
import{ cn}from "@/lib/utils";
import{ CalendarIcon,DollarSign,Info,Zap,Target,Megaphone, Users,Settings2, ClipboardList, Percent,BarChartBig,Briefcase} from 'lucide-react';
import { format, parseISO, isValid }from 'date-fns';
import {ptBR }from 'date-fns/locale';

export interface ClientAccountOption {
id: string;
name: string;
platform:'google'| 'meta'| string;
platformAccountId:string;
}

export interface CampaignFormData {
id?: string | null;
name: string;
status: string;
selectedClientAccountId?: string | null;
platform:string[];
objective:string[];
ad_format:string[];
budget?: number| string | null;
daily_budget?: number| string | null;
start_date?:Date |null;
end_date?:Date | null;
target_audience_description?: string | null;
industry?: string | null;
segmentation_notes?: string |null;
avg_ticket?: number| string| null;
}

interface CampaignManagerFormProps{
isOpen:boolean;
onClose:()=> void;
onSave: (data: Partial<CampaignFormData>)=> Promise<void>;
campaignData?: Partial<CampaignFormData> | null;
availableClientAccounts: ClientAccountOption[];
}

const initialFormData: CampaignFormData= {
name: '',
status:'draft',
selectedClientAccountId: null,
platform: [],
objective: [],
ad_format: [],
budget:'',
daily_budget:'',
start_date:null,
end_date: null,
target_audience_description: '',
industry: '',
segmentation_notes: '',
avg_ticket: '',
};

constcardStyle="bg-[#10121a]/90backdrop-blur-md borderborder-[#1E90FF]/20 shadow-xl";
constneumorphicInputStyle="bg-[#141414]text-whiteshadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]placeholder:text-gray-500border-nonefocus:ring-1focus:ring-[#1E90FF]h-9";
constneumorphicButtonStyle="bg-[#141414]border-nonetext-whiteshadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]hover:bg-[#1E90FF]/80 active:scale-[0.98]";
const primaryButtonStyle = `bg-gradient-to-rfrom-[#1E90FF]to-[#4682B4]hover:from-[#4682B4]hover:to-[#4682B4]text-white font-semibold`;// Ajustadohover
constlabelStyle= "text-xstext-gray-300font-mediummb-1 block";
const sectionTitleStyle= "text-sm font-semiboldtext-whiteflex items-centergap-2 hover:no-underlinep-3rounded-mdbg-[#141414]/60hover:bg-[#1E90FF]/10transition-all";
const selectContentStyle="bg-[#1e2128]border-[#1E90FF]/30text-white";

const MOCK_PLATFORMS=[{value: 'google', label:'Google Ads'}, {value: 'meta', label: 'Meta Ads'},{value: 'tiktok',label:'TikTok Ads'}];
constMOCK_OBJECTIVES=[{value: 'vendas', label:'Vendas'}, {value: 'leads',label:'Leads'}, {value:'trafego',label:'Tráfego'}];
const MOCK_AD_FORMATS=[{value: 'imagem',label:'Imagem'}, {value: 'video',label:'Vídeo'}, {value:'carrossel',label:'Carrossel'}];
const MOCK_STATUSES=[{value: 'draft', label: 'Rascunho'}, {value: 'active',label:'Ativa'}, {value: 'paused', label:'Pausada'}, {value:'completed',label:'Concluída'}];


export default function CampaignManagerForm({
isOpen,
onClose,
onSave,
campaignData,
availableClientAccounts,
}: CampaignManagerFormProps){
const[formData,setFormData]=useState<CampaignFormData>(initialFormData);
const[isLoading, setIsLoading]= useState(false);

useEffect(()=>{
if(isOpen){
if (campaignData) {
setFormData({
id: campaignData.id || null,
name: campaignData.name || '',
status: campaignData.status || 'draft',
selectedClientAccountId: campaignData.selectedClientAccountId || null,
platform: campaignData.platform || [],
objective: campaignData.objective || [],
ad_format: campaignData.ad_format || [],
budget: campaignData.budget || '',
daily_budget: campaignData.daily_budget || '',
start_date: campaignData.start_date?(isValid(campaignData.start_date)? campaignData.start_date: (isValid(parseISO(String(campaignData.start_date)))? parseISO(String(campaignData.start_date)): null)) : null,
end_date: campaignData.end_date?(isValid(campaignData.end_date)? campaignData.end_date: (isValid(parseISO(String(campaignData.end_date)))? parseISO(String(campaignData.end_date)): null)) : null,
target_audience_description: campaignData.target_audience_description || '',
industry: campaignData.industry || '',
segmentation_notes: campaignData.segmentation_notes || '',
avg_ticket: campaignData.avg_ticket ||'',
});
} else {
setFormData(initialFormData);
}
}
}, [campaignData,isOpen]);

const handleChange = (field: keyof CampaignFormData,value:any) => {
setFormData(prev =>({...prev, [field]:value}));
};

consthandleMultiSelectChange= (field:'platform' |'objective' |'ad_format', value:string) => {
setFormData(prev => {
const currentValues =prev[field]asstring[] ||[];
constnewValues = currentValues.includes(value)
? currentValues.filter(v =>v!== value)
:[...currentValues, value];
return{...prev, [field]: newValues};
});
};

const handleSubmit= async (e:React.FormEvent)=> {
e.preventDefault();
if(!formData.selectedClientAccountId) {
alert("Porfavor, selecione uma Contade Cliente Vinculada.");
return;
}
setIsLoading(true);
constdataToSave ={
...formData,
budget:formData.budget ?parseFloat(String(formData.budget)) :null,
daily_budget: formData.daily_budget ?parseFloat(String(formData.daily_budget)) :null,
avg_ticket: formData.avg_ticket ?parseFloat(String(formData.avg_ticket)): null,
};
awaitonSave(dataToSave);
setIsLoading(false);
};

constrenderMultiSelectButtons = (
options: { value: string; label: string }[],
field:'platform' |'objective' |'ad_format'
)=>(
<divclassName="flex flex-wrapgap-2 mt-1.5">
{options.map(opt =>(
<Button
key={opt.value}
type="button"
variant={(formData[field]asstring[]).includes(opt.value)?"default":"outline"}
onClick={() =>handleMultiSelectChange(field, opt.value)}
className={cn(
neumorphicButtonStyle,"text-xsh-8 px-3",
(formData[field]asstring[]).includes(opt.value) ? primaryButtonStyle:"bg-[#0e1015]hover:bg-[#1E90FF]/20"
)}
>
{opt.label}
</Button>
))}
</div>
);

return (
<Dialog open={isOpen} onOpenChange={(open)=> !open&& onClose()}>
<DialogContentclassName={cn(cardStyle,"max-w-3xlmd:max-w-4xlp-0border-none")}>
<DialogHeaderclassName="p-4 border-bborder-[#1E90FF]/20">
<DialogTitleclassName="text-lg font-semiboldtext-white">
{campaignData?.id ?'EditarCampanhadeTráfego': 'NovaCampanhadeTráfego'}
</DialogTitle>
<DialogDescriptionclassName="text-smtext-gray-400">
Preenchaos detalhes para {campaignData?.id ?'atualizara' :'criarumanova'}campanha.
</DialogDescription>
</DialogHeader>

<formonSubmit={handleSubmit}>
<ScrollAreaclassName="max-h-[calc(85vh-120px)]">
<divclassName="p-4 space-y-1">
<Accordion type="multiple" defaultValue={["infoPrincipais","plataformaOrcamento"]}className="w-full">

<AccordionItemvalue="infoPrincipais"className="border-none mb-2">
<AccordionTriggerclassName={sectionTitleStyle}><BriefcaseclassName="h-4 w-4mr-2text-[#1E90FF]" />Vinculação &Informações Gerais</AccordionTrigger>
<AccordionContentclassName="pt-2px-0.5 pb-0.5">
<divclassName="p-4 gridgrid-cols-1 md:grid-cols-2gap-x-4gap-y-3bg-[#0A0B0F]/30rounded-md border border-transparent hover:border-[#1E90FF]/20transition-colors">
<div>
<Label htmlFor="clientAccount"className={labelStyle}>Contade Cliente Vinculada*</Label>
<Select value={formData.selectedClientAccountId ||''} onValueChange={(value) => handleChange('selectedClientAccountId', value)}required>
<SelectTriggerid="clientAccount"className={neumorphicInputStyle}><SelectValueplaceholder="Selecionea conta..."/></SelectTrigger>
<SelectContentclassName={selectContentStyle}>
{availableClientAccounts.length=== 0&&<SelectItem value=""disabled>Nenhuma contaconectada</SelectItem>}
{availableClientAccounts.map(acc=> (<SelectItemkey={acc.id}value={acc.id}>{acc.name} ({acc.platform.toUpperCase()})</SelectItem>))}
</SelectContent>
</Select>
</div>
<div>
<Label htmlFor="name"className={labelStyle}>Nomeda Campanha*</Label>
<Input id="name" value={formData.name}onChange={(e) => handleChange('name', e.target.value)}placeholder="Ex:Lançamento Black Friday-Cliente X"className={neumorphicInputStyle} required />
</div>
<div>
<Label htmlFor="status"className={labelStyle}>Status*</Label>
<Select value={formData.status} onValueChange={(value) => handleChange('status', value)}required>
<SelectTriggerid="status"className={neumorphicInputStyle}><SelectValueplaceholder="Selecione..."/></SelectTrigger>
<SelectContentclassName={selectContentStyle}>{MOCK_STATUSES.map(opt=> (<SelectItem key={opt.value}value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
</Select>
</div>
<div>
<Label htmlFor="industry"className={labelStyle}>Indústria/Nicho</Label>
<Input id="industry" value={formData.industry || ''}onChange={(e) => handleChange('industry', e.target.value)}placeholder="Ex:E-commerce de Moda"className={neumorphicInputStyle} />
</div>
</div>
</AccordionContent>
</AccordionItem>

<AccordionItem value="plataformaOrcamento"className="border-none mb-2">
<AccordionTriggerclassName={sectionTitleStyle}><MegaphoneclassName="h-4 w-4mr-2text-[#1E90FF]" />Plataformas,Objetivos&Formatos</AccordionTrigger>
<AccordionContentclassName="pt-2px-0.5 pb-0.5">
<divclassName="p-4 space-y-4bg-[#0A0B0F]/30rounded-md border border-transparent hover:border-[#1E90FF]/20transition-colors">
<div>
<LabelclassName={labelStyle}>Plataforma(s)deAnúncio*</Label>
{renderMultiSelectButtons(MOCK_PLATFORMS, 'platform')}
{formData.platform.length=== 0 &&<pclassName="text-xstext-red-400mt-1">Selecione ao menos umaplataforma.</p>}
</div>
<div>
<LabelclassName={labelStyle}>Objetivo(s) Principal(is)</Label>
{renderMultiSelectButtons(MOCK_OBJECTIVES,'objective')}
</div>
<div>
<LabelclassName={labelStyle}>Formato(s)de Anúncio</Label>
{renderMultiSelectButtons(MOCK_AD_FORMATS,'ad_format')}
</div>
</div>
</AccordionContent>
</AccordionItem>

<AccordionItemvalue="orcamentoDatas"className="border-none mb-2">
<AccordionTriggerclassName={sectionTitleStyle}><DollarSignclassName="h-4 w-4mr-2text-[#1E90FF]" />Orçamento &Agendamento</AccordionTrigger>
<AccordionContentclassName="pt-2px-0.5 pb-0.5">
<divclassName="p-4 gridgrid-cols-1 md:grid-cols-2gap-x-4gap-y-3bg-[#0A0B0F]/30rounded-md border border-transparent hover:border-[#1E90FF]/20transition-colors">
<div>
<Label htmlFor="daily_budget"className={labelStyle}>OrçamentoDiário(R$)</Label>
<Input id="daily_budget" type="number"step="0.01" value={String(formData.daily_budget || '')}onChange={(e) => handleChange('daily_budget', e.target.value)}placeholder="Ex: 50.00"className={neumorphicInputStyle} />
</div>
<div>
<Label htmlFor="budget"className={labelStyle}>OrçamentoTotal (R$) (Opcional)</Label>
<Inputid="budget" type="number"step="0.01" value={String(formData.budget || '')}onChange={(e) => handleChange('budget', e.target.value)}placeholder="Ex: 1500.00"className={neumorphicInputStyle} />
</div>
<div>
<Label htmlFor="start_date"className={labelStyle}>Datade Início</Label>
<Popover><PopoverTrigger asChild><Button variant="outline"className={cn(neumorphicInputStyle, "w-full justify-start text-leftfont-normal", !formData.start_date &&"text-muted-foreground")}><CalendarIconclassName="mr-2h-4 w-4"/>{formData.start_date ? format(formData.start_date,'dd/MM/yyyy', {locale:ptBR}):<span>Selecione...</span>}</Button></PopoverTrigger><PopoverContentclassName={cn(selectContentStyle,"w-auto p-0")}><Calendar mode="single"selected={formData.start_date ||undefined}onSelect={(date) => handleChange('start_date', date || null)} initialFocuslocale={ptBR}/></PopoverContent></Popover>
</div>
<div>
<Label htmlFor="end_date"className={labelStyle}>DatadeTérmino (Opcional)</Label>
<Popover><PopoverTrigger asChild><Button variant="outline"className={cn(neumorphicInputStyle, "w-full justify-start text-leftfont-normal", !formData.end_date &&"text-muted-foreground")}><CalendarIconclassName="mr-2h-4 w-4"/>{formData.end_date ? format(formData.end_date,'dd/MM/yyyy', {locale:ptBR}):<span>Selecione...</span>}</Button></PopoverTrigger><PopoverContentclassName={cn(selectContentStyle,"w-auto p-0")}><Calendar mode="single"selected={formData.end_date ||undefined}onSelect={(date) => handleChange('end_date', date || null)} initialFocuslocale={ptBR}/></PopoverContent></Popover>
</div>
</div>
</AccordionContent>
</AccordionItem>

<AccordionItem value="publicoSegmentacao"className="border-none mb-2">
<AccordionTriggerclassName={sectionTitleStyle}><UsersclassName="h-4 w-4mr-2text-[#1E90FF]"/> Público &Segmentação</AccordionTrigger>
<AccordionContentclassName="pt-2px-0.5 pb-0.5">
<divclassName="p-4 space-y-3bg-[#0A0B0F]/30rounded-md border border-transparent hover:border-[#1E90FF]/20transition-colors">
<div>
<Label htmlFor="target_audience_description"className={labelStyle}>DescriçãodoPúblico-Alvo</Label>
<Textareaid="target_audience_description" value={formData.target_audience_description || ''}onChange={(e) => handleChange('target_audience_description', e.target.value)}placeholder="Descreva as características demográficas,interesses, comportamentos..."className={cn(neumorphicInputStyle,"min-h-[80px]")} />
</div>
<div>
<Label htmlFor="segmentation_notes"className={labelStyle}>NotasAdicionaisdeSegmentação</Label>
<Textareaid="segmentation_notes" value={formData.segmentation_notes || ''}onChange={(e) => handleChange('segmentation_notes', e.target.value)}placeholder="Detalhessobre geolocalização, dispositivos,exclusões, etc."className={cn(neumorphicInputStyle,"min-h-[60px]")} />
</div>
</div>
</AccordionContent>
</AccordionItem>

<AccordionItem value="metricasNegocio"className="border-none">
<AccordionTriggerclassName={sectionTitleStyle}><PercentclassName="h-4 w-4mr-2text-[#1E90FF]"/>MétricasdeNegócio (Opcional)</AccordionTrigger>
<AccordionContentclassName="pt-2px-0.5 pb-0.5">
<divclassName="p-4 gridgrid-cols-1 md:grid-cols-2gap-x-4gap-y-3bg-[#0A0B0F]/30rounded-md border border-transparent hover:border-[#1E90FF]/20transition-colors">
<div>
<Label htmlFor="avg_ticket"className={labelStyle}>TicketMédioEstimado(R$)</Label>
<Input id="avg_ticket" type="number"step="0.01" value={String(formData.avg_ticket || '')}onChange={(e) => handleChange('avg_ticket', e.target.value)}placeholder="Ex: 197.00"className={neumorphicInputStyle} />
</div>
</div>
</AccordionContent>
</AccordionItem>

</Accordion>
</div>
</ScrollArea>

<DialogFooterclassName="p-4 border-tborder-[#1E90FF]/20gap-2 flex-wrapjustify-end">
<DialogClose asChild>
<Button type="button" variant="outline"className={cn(neumorphicButtonStyle, "h-8 px-3text-xs")}disabled={isLoading}>Cancelar</Button>
</DialogClose>
<Button type="submit"className={cn(primaryButtonStyle, "h-8 px-4text-xs")}disabled={isLoading || !formData.selectedClientAccountId|| formData.platform.length=== 0 || !formData.name.trim()}>
{isLoading? 'Salvando...': (campaignData?.id ? 'SalvarAlterações' :'Criar Campanha')}
</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}
