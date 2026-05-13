import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListDevices, getListDevicesQueryKey,
  useListFleetRecentPackets, getListFleetRecentPacketsQueryKey,
  Device,
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Signal, Timer, Wrench, AlertTriangle, Search, Download,
  ChevronRight, TrendingUp, Clock
} from "lucide-react";
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const MAINT_LIMIT_H = 500;

function getMaintStatus(hourmeterH: number, limitH: number): "overdue" | "upcoming" | "ok" {
  const remaining = limitH - (hourmeterH % limitH);
  if (remaining <= 0 || hourmeterH % limitH === 0) return "overdue";
  if (remaining <= 50) return "upcoming";
  return "ok";
}

function statusBadge(status: "overdue" | "upcoming" | "ok" | "active" | "stopped" | "no-signal") {
  switch (status) {
    case "overdue":   return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">ATRASADA</span>;
    case "upcoming":  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">PRÓXIMA</span>;
    case "ok":        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">NORMAL</span>;
    case "active":    return <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Ativa</span>;
    case "stopped":   return <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Parada</span>;
    case "no-signal": return <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />Sem sinal</span>;
  }
}

export default function FleetOverview() {
  const { t, locale } = useI18n();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "stopped" | "overdue" | "upcoming">("all");
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: devices = [], isLoading } = useListDevices(
    undefined,
    { query: { refetchInterval: 15000, queryKey: getListDevicesQueryKey() } }
  );

  const { data: recentPackets = [] } = useListFleetRecentPackets(
    { limit: 100 },
    { query: { refetchInterval: 15000, queryKey: getListFleetRecentPacketsQueryKey({ limit: 100 }) } }
  );

  const now = Date.now();
  const tenMinsAgo = new Date(now - 10 * 60 * 1000);
  const yesterday = subDays(new Date(), 1);
  const d1Start = startOfDay(yesterday);
  const d1End = endOfDay(yesterday);

  // Compute D-1 hours per device using recent packets as a proxy
  // (actual D-1 hours would come from a dedicated report endpoint; here we approximate)
  const activeDevices  = devices.filter(d => d.lastSeenAt && new Date(d.lastSeenAt) > tenMinsAgo);
  const totalHourMeter = devices.reduce((s, d) => s + (d.lastHourmeterMin ?? 0), 0);
  const overdueMachines = devices.filter(d => {
    if (!d.lastHourmeterMin) return false;
    const limitH = d.serviceLimitHours ?? MAINT_LIMIT_H;
    return getMaintStatus(d.lastHourmeterMin / 60, limitH) === "overdue";
  });
  const upcomingMachines = devices.filter(d => {
    if (!d.lastHourmeterMin) return false;
    const limitH = d.serviceLimitHours ?? MAINT_LIMIT_H;
    return getMaintStatus(d.lastHourmeterMin / 60, limitH) === "upcoming";
  });

  const kpis = [
    {
      label: t.fleet.kpi.activeFleet,
      value: activeDevices.length.toString(),
      sub: `${t.common.of} ${devices.length} ${t.common.online}`,
      color: "emerald",
      icon: <Signal className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.totalHourMeter,
      value: `${(totalHourMeter / 60).toFixed(0)}h`,
      sub: t.fleet.kpi.totalHourMeterSub,
      color: "blue",
      icon: <Timer className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.upcomingRevision,
      value: upcomingMachines.length.toString(),
      sub: t.fleet.kpi.upcomingRevisionSub,
      color: "amber",
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.overdueRevision,
      value: overdueMachines.length.toString(),
      sub: t.fleet.kpi.overdueRevisionSub,
      color: "red",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      label: "Pacotes D-1",
      value: recentPackets.length.toString(),
      sub: "telemetria recebida",
      color: "violet",
      icon: <TrendingUp className="w-4 h-4" />,
    },
  ] as const;

  const colorMap = {
    emerald: { card: "border-emerald-500/20 bg-emerald-500/5", icon: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", val: "text-emerald-500" },
    blue:    { card: "border-primary/20 bg-primary/5", icon: "text-primary bg-primary/10 border-primary/20", val: "text-primary" },
    amber:   { card: "border-amber-500/20 bg-amber-500/5", icon: "text-amber-500 bg-amber-500/10 border-amber-500/20", val: "text-amber-500" },
    red:     { card: "border-destructive/20 bg-destructive/5", icon: "text-destructive bg-destructive/10 border-destructive/20", val: "text-destructive" },
    violet:  { card: "border-violet-500/20 bg-violet-500/5", icon: "text-violet-400 bg-violet-500/10 border-violet-500/20", val: "text-violet-400" },
  } as const;

  // Compute device status
  function devStatus(d: Device): "active" | "stopped" | "no-signal" {
    if (!d.lastSeenAt) return "no-signal";
    if (new Date(d.lastSeenAt) > tenMinsAgo) return "active";
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    if (new Date(d.lastSeenAt) > oneHourAgo) return "stopped";
    return "no-signal";
  }

  function maintStatus(d: Device): "overdue" | "upcoming" | "ok" {
    if (!d.lastHourmeterMin) return "ok";
    return getMaintStatus(d.lastHourmeterMin / 60, d.serviceLimitHours ?? MAINT_LIMIT_H);
  }

  function hourmeterH(d: Device) {
    return d.lastHourmeterMin != null ? d.lastHourmeterMin / 60 : null;
  }

  function remainingH(d: Device) {
    const h = hourmeterH(d);
    if (h == null) return null;
    const limitH = d.serviceLimitHours ?? MAINT_LIMIT_H;
    return limitH - (h % limitH);
  }

  const filterTabs = [
    { key: "all" as const, label: "Todas" },
    { key: "active" as const, label: "Ativas" },
    { key: "stopped" as const, label: "Paradas" },
    { key: "overdue" as const, label: "Atrasadas" },
    { key: "upcoming" as const, label: "Próximas" },
  ];

  const filtered = devices.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      const name = (d.displayName ?? d.id).toLowerCase();
      if (!name.includes(q) && !d.id.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "active")   return devStatus(d) === "active";
    if (statusFilter === "stopped")  return devStatus(d) !== "active";
    if (statusFilter === "overdue")  return maintStatus(d) === "overdue";
    if (statusFilter === "upcoming") return maintStatus(d) === "upcoming";
    return true;
  });

  return (
    <Shell>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.fleet.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(yesterday, "dd 'de' MMMM 'de' yyyy", { locale: dateLocale })} · {t.fleet.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocation("/reports")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {t.fleet.export}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((kpi, i) => {
            const c = colorMap[kpi.color];
            return (
              <div key={i} className={`bg-card border rounded-xl p-4 ${c.card}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${c.icon}`}>
                  {kpi.icon}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold tracking-tight leading-none ${c.val}`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* D-1 Table */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t.fleet.roster.title}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.fleet.roster.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {new Date().toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {/* Search + filter */}
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/40 rounded-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 w-52"
                placeholder={t.fleet.roster.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length} {filtered.length === 1 ? "máquina" : "máquinas"}</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-2.5 text-left font-medium">{t.fleet.roster.cols.machine}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t.fleet.roster.cols.model}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.fleet.roster.cols.hourmeter}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.fleet.roster.cols.nextRevision}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.fleet.roster.cols.remaining}</th>
                  <th className="px-4 py-2.5 text-left font-medium">Comunicação</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t.fleet.roster.cols.status}</th>
                  <th className="px-4 py-2.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">{t.fleet.roster.noData}</td></tr>
                ) : (
                  filtered.map(d => {
                    const ds = devStatus(d);
                    const ms = maintStatus(d);
                    const hh = hourmeterH(d);
                    const rem = remainingH(d);
                    const limitH = d.serviceLimitHours ?? MAINT_LIMIT_H;
                    const pct = hh != null ? Math.min(100, ((hh % limitH) / limitH) * 100) : 0;

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/devices/${d.id}`)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold text-sm text-foreground">{d.displayName ?? d.id}</div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">ID: {d.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-foreground">{d.machineModel ?? <span className="text-muted-foreground italic">—</span>}</div>
                          {d.machineType && <div className="text-[10px] text-muted-foreground">{d.machineType}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {hh != null ? `${hh.toFixed(1)}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-xs text-muted-foreground">{limitH}h</span>
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  ms === "overdue" ? "bg-red-500" : ms === "upcoming" ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-sm font-semibold ${
                            ms === "overdue" ? "text-red-400" : ms === "upcoming" ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {rem != null ? `${rem.toFixed(0)}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[11px] text-muted-foreground">
                            {d.lastSeenAt
                              ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true, locale: dateLocale })
                              : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {statusBadge(ds)}
                            {statusBadge(ms)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
