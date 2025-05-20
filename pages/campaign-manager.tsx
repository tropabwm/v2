//pages/campaign-manager.tsx
import { useState, useEffect, useCallback} from 'react';
importHead from 'next/head'; //Corrigidoaqui
importLayout from'@/components/layout';
import {Button} from'@/components/ui/button';
import {Input }from'@/components/ui/input';
import {useToast} from'@/components/ui/use-toast';
import{ cn} from'@/lib/utils';
import {PlusCircle,ListFilter,Search,Edit,Trash2,ExternalLink} from 'lucide-react';
importCampaignManagerForm,{ CampaignFormData,ClientAccountOption} from'@/components/CampaignManagerForm';
import {useAuth} from'@/context/AuthContext';
import {useRouter} from 'next/router';
import {Card,CardContent,CardHeader,CardTitle} from'@/components/ui/card';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from'@/components/ui/table';
import {Badge} from '@/components/ui/badge'; //Parastatus
import{
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
}from '@/components/ui/dropdown-menu';//Para ações
import {MoreHorizontal} from 'lucide-react';
importLabelfrom '@/components/ui/label'; //Importação doLabel

//Interface paraa campanhacomlistana página(podeserdiferentede CampaignFormData)
interface CampaignListItem extendsCampaignFormData{
id:string; //IDéobrigatóriona lista
clientAccountName?: string;//Nomedacontado clienteparaexibição
platformText?: string; //Plataformasformatadas paraexibição
}

//DADOSMOCKADOS- SUBSTITUIRPELOAPIREAL
constMOCK_AVAILABLE_CLIENT_ACCOUNTS: ClientAccountOption[] =[
{ id: 'client_acc_1',name: 'Loja XPTO- GoogleAds',platform: 'google',platformAccountId:'customers/1234567890'},
{ id: 'client_acc_2',name: 'ServiçosABC- MetaAds',platform: 'meta',platformAccountId: 'act_9876543210' },
{ id: 'client_acc_3', name: 'ImobiliáriaZ -GoogleAds', platform: 'google',platformAccountId: 'customers/1122334455' },
];

constMOCK_CAMPAIGNS:CampaignListItem[] =[
{
id: 'camp1',name: 'PromoçãoVerão- LojaXPTO',status: 'active',
selectedClientAccountId: 'client_acc_1',clientAccountName: 'LojaXPTO- GoogleAds',
platform:['google'], platformText: 'Google Ads',
daily_budget: 50,start_date: new Date('2024-01-15'),
objective:['vendas'],ad_format:['imagem'],
},
{
id: 'camp2', name: 'LeadsQualificados- ServiçosABC', status: 'paused',
selectedClientAccountId: 'client_acc_2',clientAccountName: 'ServiçosABC- MetaAds',
platform: ['meta'], platformText: 'Meta Ads',
daily_budget:30,start_date: new Date('2024-02-01'),
objective:['leads'],ad_format: ['video'],
},
];

//FIMDOSDADOSMOCKADOS

export default function CampaignManagerPage() {
const{isAuthenticated,isLoading:authLoading,token}= useAuth(); //Adicionartoken
constrouter= useRouter();
const{ toast} =useToast();
const [isFormOpen,setIsFormOpen] = useState(false);
const[editingCampaign,setEditingCampaign] = useState<Partial<CampaignFormData>| null>(null);

const [campaigns,setCampaigns] = useState<CampaignListItem[]>([]);
const [isLoadingCampaigns,setIsLoadingCampaigns] = useState(true);
const [availableClientAccounts,setAvailableClientAccounts] =useState<ClientAccountOption[]>([]);
const [searchTerm,setSearchTerm] = useState('');

constneonColor= '#1E90FF';
constprimaryButtonStyle =`bg-gradient-to-rfrom-[${neonColor}] to-[#4682B4]hover:from-[#4682B4] hover:to-[${neonColor}]text-whitefont-semiboldshadow-[0_4px_10px_rgba(30,144,255,0.4)]`;
constcardStyle="bg-[#141414]/80backdrop-blur-smshadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)]rounded-lgborder-none";
constneumorphicInputStyle= "bg-[#141414]text-whiteshadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]placeholder:text-gray-500border-nonefocus:ring-2focus:ring-[#1E90FF] focus:ring-offset-2focus:ring-offset-[#0e1015] h-9";
consttableHeaderStyle ="text-xsfont-semiboldtext-gray-400uppercasetracking-wider";
consttableCellStyle= "text-sm text-gray-200py-2.5";
conststatusBadgeColors: {[key:string]: string} ={
draft: 'bg-gray-500/80border-gray-400/50text-gray-100',
active: 'bg-green-500/80border-green-400/50text-green-50shadow-[0_0_4px_#32CD32]',
paused: 'bg-yellow-500/80border-yellow-400/50text-yellow-50',
completed: 'bg-blue-500/80border-blue-400/50text-blue-50',
archived: 'bg-slate-600/80border-slate-500/50text-slate-300',
};

const fetchClientAccounts= useCallback(async () => {
if(!token) return;
//TODO:ImplementarAPI real: GET /api/client-accounts(ousimilar)
//Porenquanto,usarmock
console.log("Simulandofetch decontasdeclientes...");
setAvailableClientAccounts(MOCK_AVAILABLE_CLIENT_ACCOUNTS);
}, [token]);

constfetchCampaigns= useCallback(async () =>{
if(!token) return;
setIsLoadingCampaigns(true);
//TODO: ImplementarAPI real: GET /api/campaigns
//Por enquanto,usarmock emapear paraCampaignListItem
console.log("Simulandofetch decampanhas...");
constmappedMockCampaigns= MOCK_CAMPAIGNS.map(c=> {
return {
...c,
clientAccountName:MOCK_AVAILABLE_CLIENT_ACCOUNTS.find(acc =>acc.id===c.selectedClientAccountId)?.name|| 'N/A',
platformText: c.platform?.join(',')|| 'N/A', //Ajustarconforme aestruturarealde 'platform'
};
});
setCampaigns(mappedMockCampaigns);
setIsLoadingCampaigns(false);
}, [token]);

useEffect(()=> {
if(!authLoading&& !isAuthenticated) {
router.push('/login');
} elseif(!authLoading&&isAuthenticated&& token) {
fetchClientAccounts();
fetchCampaigns();
}
}, [authLoading,isAuthenticated,router,token,fetchClientAccounts,fetchCampaigns]);

const handleOpenForm= (campaign?:CampaignListItem) =>{
//MapearCampaignListItemparaCampaignFormDatasenecessárioparaedição
constformDataForEdit= campaign? {
...campaign,
//Garanta queos campos dedatasejamobjetosDate evenhamcomostringda lista
start_date:campaign.start_date? new Date(campaign.start_date) :null,
end_date:campaign.end_date? new Date(campaign.end_date) :null,
}:null;
setEditingCampaign(formDataForEdit);
setIsFormOpen(true);
};

consthandleCloseForm= () =>{
setIsFormOpen(false);
setEditingCampaign(null);
};

const handleSaveCampaign= async (formData: Partial<CampaignFormData>) =>{
setIsLoadingCampaigns(true); //Mostrarfeedback decarregamentona lista
console.log("Salvandocampanha(frontend):",formData);
//TODO:Implementarchamadaà APIPOST/PUT/api/campaigns
//Exemplo:
//constmethod= formData.id? 'PUT' :'POST';
//const url=formData.id?`/api/campaigns?id=${formData.id}`: '/api/campaigns';
//try{
//awaitaxios({ method,url,data: formData,headers: {Authorization: `Bearer${token}`}});
//toast({title:"Sucesso",description: `Campanha${formData.id?'':''} criada!`});
//fetchCampaigns(); //Re-fetchda lista
//}catch (error: any) {
//toast({title:"Erro",description:error.response?.data?.message||"Falhaaosalvar.",variant:"destructive"});
//setIsLoadingCampaigns(false);
//}
//Mock desucessopor enquanto:
setTimeout(() =>{
toast({title: "Sucesso(Mock)",description: `Campanha${formData.id?`"${formData.name}"atualizada`:`"${formData.name}" criada`}!`});
fetchCampaigns(); //Re-fetch(aindausarámock)
},500);
handleCloseForm();
};

const handleDeleteCampaign= async (campaignId: string) => {
if(!confirm("Tem certezaquedesejaexcluirestacampanha?Esta açãonãopode serdesfeita.")) return;
//TODO:Implementarchamadaà APIDELETE/api/campaigns?id=${campaignId}
console.log("ExcluindocampanhaID:",campaignId);
toast({title: "Excluído(Mock)",description: `Campanha${campaignId}excluída.`,variant: "destructive"});
//setCampaigns(prev=>prev.filter(c=>c.id!==campaignId)); //Atualizaçãootimista
fetchCampaigns(); //Ou re-fetch
};

constfilteredCampaigns= campaigns.filter(campaign=>
campaign.name.toLowerCase().includes(searchTerm.toLowerCase())||
(campaign.clientAccountName&&campaign.clientAccountName.toLowerCase().includes(searchTerm.toLowerCase()))||
(campaign.platformText&&campaign.platformText.toLowerCase().includes(searchTerm.toLowerCase()))
);

if (authLoading&& !token) return<Layout><divclassName="p-6text-center">Carregandoautenticação...</div></Layout>;
if(!isAuthenticated&& !authLoading) returnnull;

return (
<Layout>
<Head><title>Gestão deTráfego-USBMKT</title></Head>
<divclassName="space-y-5p-4md:p-6">
<divclassName="flex flex-col md:flex-row justify-betweenitems-startmd:items-centergap-3">
<h1className="text-2xlfont-blacktext-white"style={{textShadow:`08px${neonColor}`}}>
Gestão deTráfego
</h1>
<ButtonclassName={cn(primaryButtonStyle,"h-9text-sm")}onClick={() =>handleOpenForm()}>
<PlusCircleclassName="mr-2h-4w-4"/>AdicionarCampanha
</Button>
</div>

<CardclassName={cn(cardStyle,"p-3")}>
<divclassName="gridgrid-cols-1md:grid-cols-3gap-3items-end">
<divclassName="md:col-span-2">
<LabelhtmlFor="searchCampaign" className="text-xstext-gray-300mb-1block">Buscar(Nome,Cliente,Plataforma)</Label>
<divclassName="relative">
<SearchclassName="absoluteleft-2.5top-1/2-translate-y-1/2h-4w-4text-gray-400" />
<Input
id="searchCampaign"
placeholder="Digite parabuscar..."
className={cn(neumorphicInputStyle,"pl-8h-8text-xs")}
value={searchTerm}
onChange={(e) =>setSearchTerm(e.target.value)}
/>
</div>
</div>
{/*TODO:Adicionarmaisfiltros(Status,Plataforma,Cliente) */}
<Buttonvariant="outline" className="bg-[#141414] border-nonetext-whiteshadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)]hover:bg-[#1E90FF]/80h-8text-xsmt-3md:mt-0">
<ListFilterclassName="mr-2h-3.5w-3.5" />AplicarFiltros
</Button>
</div>
</Card>

<CardclassName={cn(cardStyle)}>
<CardHeaderclassName="px-4py-3border-bborder-[#1E90FF]/10">
<CardTitleclassName="text-basefont-semiboldtext-white">Lista deCampanhas</CardTitle>
</CardHeader>
<CardContentclassName="p-0">
{isLoadingCampaigns&& !authLoading?(
//Nãomostrarloader decampanhasse aautenticaçãoestivercarregando
<pclassName="text-centertext-gray-400py-10">Carregandocampanhas...</p>
):filteredCampaigns.length === 0? (
<pclassName="text-centertext-gray-400py-10">Nenhumcampanhaencontrado. {searchTerm&&"Tenterefinarsua buscaou"}Cliqueem "AdicionarCampanha".</p>
): (
<divclassName="overflow-x-auto">
<Table>
<TableHeader>
<TableRowclassName="border-b border-[#1E90FF]/10hover:bg-transparent">
<TableHeadclassName={cn(tableHeaderStyle, "pl-4")}>Nomeda Campanha</TableHead>
<TableHeadclassName={tableHeaderStyle}>ClienteVinculado</TableHead>
<TableHeadclassName={tableHeaderStyle}>Plataforma(s)</TableHead>
<TableHeadclassName={cn(tableHeaderStyle,"text-center")}>Status</TableHead>
<TableHeadclassName={cn(tableHeaderStyle, "text-rightpr-4")}>OrçamentoDiário</TableHead>
<TableHeadclassName={cn(tableHeaderStyle,"text-center")}>Ações</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{filteredCampaigns.map(campaign=> (
<TableRowkey={campaign.id} className="border-bborder-[#1E90FF]/5hover:bg-[#0A0B0F]/50transition-colors">
<TableCellclassName={cn(tableCellStyle,"font-mediumpl-4")}>{campaign.name}</TableCell>
<TableCellclassName={tableCellStyle}>{campaign.clientAccountName|| 'N/A'}</TableCell>
<TableCellclassName={tableCellStyle}>{campaign.platformText|| 'N/A'}</TableCell>
<TableCellclassName={cn(tableCellStyle, "text-center")}>
<Badgevariant="outline" className={cn("text-[10px] px-1.5py-0.5border",statusBadgeColors[campaign.status.toLowerCase()] ||statusBadgeColors.draft)}>
{MOCK_STATUSES.find(s=>s.value ===campaign.status)?.label||campaign.status}
</Badge>
</TableCell>
<TableCellclassName={cn(tableCellStyle,"text-right")}>
{campaign.daily_budget? `R$${Number(campaign.daily_budget).toFixed(2)}`: 'N/A'}
</TableCell>
<TableCellclassName={cn(tableCellStyle, "text-centerpr-4")}>
<DropdownMenu>
<DropdownMenuTriggerasChild>
<Buttonvariant="ghost" className="h-7w-7p-0data-[state=open]:bg-slate-700">
<MoreHorizontalclassName="h-4w-4" />
</Button>
</DropdownMenuTrigger>
<DropdownMenuContentalign="end" className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
<DropdownMenuItemonClick={() =>handleOpenForm(campaign)} className="cursor-pointerhover:!bg-[#1E90FF]/20"><Edit className="mr-2h-3.5w-3.5" />Editar</DropdownMenuItem>
{/*<DropdownMenuItemclassName="cursor-pointerhover:!bg-[#1E90FF]/20"><BarChartBig className="mr-2h-3.5w-3.5" />VerDetalhes</DropdownMenuItem>*/}
{/*<DropdownMenuItemclassName="cursor-pointerhover:!bg-[#1E90FF]/20"><ExternalLinkclassName="mr-2h-3.5w-3.5" />AbrirnaPlataforma</DropdownMenuItem> */}
<DropdownMenuItemonClick={() =>handleDeleteCampaign(campaign.id!)} className="cursor-pointer text-red-400hover:!bg-red-700/30"><Trash2 className="mr-2h-3.5w-3.5" />Excluir</DropdownMenuItem>
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

{isFormOpen&& (
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
