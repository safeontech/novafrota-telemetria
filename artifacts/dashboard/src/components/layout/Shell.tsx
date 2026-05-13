import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { useApiToken } from "@/lib/api-auth";
import { useI18n } from "@/lib/i18n";
import { useTheme, Theme } from "@/lib/theme";
import {
  LayoutDashboard, Wrench, Map, FileText, Cpu, Users, Building2,
  LogOut, Signal, SignalZero, Activity, Sun, Moon, Palette,
  Globe, ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  icon: ReactNode;
  label: string;
  href: string;
  badge?: number;
}

export function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { clearToken } = useApiToken();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const { data: health, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 30000,
      retry: false,
    },
  });

  const handleSignOut = () => {
    clearToken();
    setLocation("/login");
  };

  const navPanels: NavItem[] = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: t.nav.dashboard, href: "/" },
    { icon: <span className="text-base leading-none">🚜</span>, label: t.nav.machines, href: "/machines" },
    { icon: <Wrench className="w-4 h-4" />, label: t.nav.maintenance, href: "/maintenance" },
  ];

  const navMonitoring: NavItem[] = [
    { icon: <Map className="w-4 h-4" />, label: t.nav.grid, href: "/grid" },
    { icon: <FileText className="w-4 h-4" />, label: t.nav.reports, href: "/reports" },
    { icon: <Cpu className="w-4 h-4" />, label: t.nav.devices, href: "/registered-devices" },
    { icon: <Users className="w-4 h-4" />, label: t.nav.users, href: "/users" },
    { icon: <Building2 className="w-4 h-4" />, label: t.nav.clients, href: "/clients" },
  ];

  const themeOptions: { value: Theme; label: string; icon: ReactNode }[] = [
    { value: "dark-navy", label: t.theme.darkNavy, icon: <Moon className="w-4 h-4" /> },
    { value: "dark-amber", label: t.theme.darkAmber, icon: <Palette className="w-4 h-4" /> },
    { value: "light", label: t.theme.light, icon: <Sun className="w-4 h-4" /> },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link href={item.href}>
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] transition-all duration-150 select-none group ${
        isActive(item.href)
          ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}>
        <span className={isActive(item.href) ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"}>
          {item.icon}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="text-[10px] font-bold bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] min-w-[220px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed top-0 left-0 h-screen z-20">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0 text-white font-black text-[11px]">
            NF
          </div>
          <div className="min-w-0">
            <div className="font-black text-[14px] leading-tight tracking-tight text-sidebar-foreground">
              {t.appName}
            </div>
            <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mt-0.5">
              {t.appSub}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* PAINÉIS */}
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3 pb-1.5 pt-1">
            {t.nav.panels}
          </p>
          {navPanels.map((item) => <NavLink key={item.href} item={item} />)}

          {/* MONITORAMENTO */}
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3 pb-1.5 pt-4">
            {t.nav.monitoring}
          </p>
          {navMonitoring.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-2 py-3 space-y-1">
          {/* Connection status */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-sidebar-foreground/50">
            {isError ? (
              <><SignalZero className="w-3.5 h-3.5 text-destructive" /><span className="text-destructive">Offline</span></>
            ) : health?.status === "ok" ? (
              <><Signal className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-400">{t.fleet.status.nominal}</span></>
            ) : (
              <><Activity className="w-3.5 h-3.5 text-amber-500 animate-pulse" /><span>{t.fleet.status.connecting}</span></>
            )}
          </div>

          {/* Language switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150">
                <Globe className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{locale === "pt" ? "Português" : "English"}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-40">
              <DropdownMenuLabel>Idioma / Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocale("pt")} className={locale === "pt" ? "text-primary font-medium" : ""}>
                🇧🇷 Português
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale("en")} className={locale === "en" ? "text-primary font-medium" : ""}>
                🇺🇸 English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150">
                {theme === "light" ? <Sun className="w-4 h-4 shrink-0" /> : theme === "dark-amber" ? <Palette className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                <span className="flex-1 text-left">{t.theme.label}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-44">
              <DropdownMenuLabel>{t.theme.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {themeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`gap-2 ${theme === opt.value ? "text-primary font-medium" : ""}`}
                >
                  {opt.icon}
                  {opt.label}
                  {theme === opt.value && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{t.nav.signOut}</span>
          </button>

          <div className="px-3 pt-1 pb-0.5 flex items-center gap-2 text-sidebar-foreground/30 text-[10px]">
            <span>{t.common.administrator}</span>
            <span className="ml-auto">{t.common.version}</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 ml-[220px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
