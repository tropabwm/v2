// components/ui/sidebar.tsx
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
// Importe TODOS os ícones Lucide que você usa na lista navItems e no botão
import {
  LayoutDashboard, Target, DollarSign, BarChart3, CalendarDays, FileText,
  Lightbulb, LineChart, TrendingUp, Bell, MessageSquare, Settings, LifeBuoy, Power,
  Filter, Upload, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Type, ListChecks, Clock, Variable, Waypoints, HelpCircle, RadioTower,
  UserCheck, LogOut, Workflow, Users, BarChart2, Square, Eye, Map, Share2, Pencil,
  Check, X, GripVertical, List, Grid, ExternalLink, Paperclip, Save, Sparkles, Bot,
  Megaphone // <<< Ícone Megaphone importado
} from "lucide-react";
import Image from "next/image";
// IMPORTAR O HOOK DO CONTEXTO DA SIDEBAR ESQUERDA
import { useLeftSidebarContext } from '../../context/LeftSidebarContext'; // Importar o hook
// Importar estilos utilitários - Ajuste o caminho se necessário
import { NEON_COLOR, baseButtonSelectStyle, baseInputInsetStyle, popoverContentStyle, baseCardStyle } from '@/components/flow/utils';

// --- Interfaces e Constantes ---
interface NavItem { href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string; }
const neonColor = NEON_COLOR; // Usar a cor neon do utilitário

const navItems: NavItem[] = [
    { href: "/", icon: LayoutDashboard, label: "Painel" },
    { href: "/Campaign", icon: Target, label: "Campanhas" }, // Mantido se for a listagem simples original
    { href: "/campaign-manager", icon: Megaphone, label: "Gestão de Tráfego" }, // <<< NOVO ITEM ADICIONADO / SUBSTITUINDO LTV
    { href: "/Budget", icon: DollarSign, label: "Orçamento" },
    { href: "/Funnel", icon: Filter, label: "Funil" },
    { href: "/Dates", icon: CalendarDays, label: "Datas" },
    { href: "/CopyPage", icon: FileText, label: "Copy" },
    { href: "/Suggestions", icon: Lightbulb, label: "Sugestões" },
    { href: "/Metrics", icon: BarChart3, label: "Métricas" },
    { href: "/Projection", icon: TrendingUp, label: "Projeções" },
    { href: "/alerts", icon: Bell, label: "Alertas" },
    // { href: "/ltv", icon: LineChart, label: "LTV" }, // <<< ITEM LTV REMOVIDO/COMENTADO
    { href: "/creatives", icon: ImageIcon, label: "Criativos" },
    { href: "/Chat", icon: MessageSquare, label: "Chat IA" },
    { href: "/zap", icon: MessageSquare, label: "Zap" },
    { href: "/builder", icon: Pencil, label: "Webpage" },
    { href: "/export", icon: Upload, label: "Exportar" },
];

interface SidebarProps {
  isHidden?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isHidden }) => {
  const { isLeftCollapsed, toggleLeftCollapse } = useLeftSidebarContext();

  if (isHidden) {
    return null;
  }

  const pathname = usePathname();
  const sidebarWidthClass = isLeftCollapsed ? "w-16" : "w-60";
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${neonColor})` };
  const textNeonStyle = { textShadow: `0 0 4px ${neonColor}` };


  return (
    <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full flex-col",
        baseCardStyle,
        "border-r border-[#1E90FF]/20",
        sidebarWidthClass,
        "transition-all duration-300 ease-in-out"
        )}
        >
        <div className={cn(
            "flex items-center border-b border-[#2D62A3]/20 p-2 relative flex-shrink-0",
            isLeftCollapsed ? "h-16 justify-center" : "h-20 justify-center"
            )}>
          <Link href="/" className={cn( "flex items-center justify-center w-full h-full", isLeftCollapsed ? 'max-w-[44px]' : 'max-w-[180px]' )}>
              <div className={cn("relative", isLeftCollapsed ? "w-[44px] h-[44px]" : "w-[180px] h-[50px]")}>
                  <Image src="/logo.png" alt="Logo USBMKT" fill className="object-contain" style={{ filter: `drop-shadow(0 0 10px ${neonColor})` }} priority sizes={isLeftCollapsed ? "44px" : "180px"} />
              </div>
          </Link>
        </div>

        <nav className="flex-grow overflow-y-auto overflow-x-hidden px-2 py-2 space-y-1 custom-scrollbar">
           {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const navItemBaseStyle = cn(
                  "group flex items-center rounded-md",
                  baseCardStyle,
                  "p-2",
                  isLeftCollapsed ? "justify-center w-10 h-10" : "justify-start w-full h-auto",
                  "transition-all duration-150 ease-out",
                  `hover:neumorphic-neon-outset-glow`,
                  isActive && `neumorphic-neon-outset-glow`
              );

              const linkContent = ( <>
                  <item.icon className={cn(
                      "shrink-0",
                      isLeftCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2",
                      isActive ? `text-white` : `text-[${neonColor}]`
                  )} style={ isActive ? {} : iconNeonFilterStyle } />

                  {!isLeftCollapsed && (
                      <span className={cn(
                          "truncate font-medium",
                          "text-xs",
                          isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                      )}
                       style={isActive ? {} : textNeonStyle}
                      >
                          {item.label}
                      </span>
                  )}
              </> );
              return (
                  <Link key={item.href} href={item.href} className={navItemBaseStyle} aria-current={isActive ? "page" : undefined} >
                      {linkContent}
                  </Link>
              );
            })}
        </nav>

        <div className="border-t border-[#2D62A3]/20 p-2 mt-auto flex-shrink-0">
            <button onClick={toggleLeftCollapse} className={cn(
                "group flex items-center rounded-md h-8 text-sm w-full",
                baseButtonSelectStyle,
                isLeftCollapsed ? "justify-center" : "justify-start pl-3",
                `hover:!bg-[${neonColor}]/20`
                )} aria-label={isLeftCollapsed ? "Expandir sidebar" : "Recolher sidebar"} >
                {isLeftCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white" />
                ) : (
                    <>
                        <ChevronLeft className="h-4 w-4 mr-2 text-gray-400 group-hover:text-white" />
                        <span className="text-gray-400 group-hover:text-white">Recolher</span>
                    </>
                )}
            </button>
        </div>
      </aside>
  );
};

export default Sidebar;
