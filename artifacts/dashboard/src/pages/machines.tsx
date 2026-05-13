import { useState } from "react";
import { useLocation } from "wouter";
import { useListDevices, getListDevicesQueryKey, Device } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, ChevronRight, Wrench, Signal, AlertTriangle, Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const DEFAULT_LIMIT_H = 500;

function getMaintStatus(hourmeterH: number, limitH: number): "overdue" | "upcoming" | "ok" {
  const remaining = limitH - (hourmeterH % limitH);
  if (remaining <= 0 || hourmeterH % limitH === 0) return "overdue";
  if (remaining <= 50) return "upcoming";
  return "ok";
}

function getDeviceStatus(d: Device): "active" | "stopped" | "no-signal" {
  if (!d.lastSeenAt) return "no-signal";
  const tenMin = new Date(Date.now() - 10 * 60 * 1000);
  if (new Date(d.lastSeenAt) > tenMin) return "active";
  const oneH = new Date(Date.now() - 60 * 60 * 1000);
  if (new Date(d.lastSeenAt) > oneH) return "stopped";
  return "no-signal";
}

type FilterTab = "all" | "active" | "upcoming" | "overdue" | "stopped";

export default function Machines() {
  const { t, locale } = useI18n();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: devices = [], isLoading, isError } = useListDevices(undefined, {
    query: { refetchInterval: 15000, queryKey: getListDevicesQueryKey() },
  });

  const counts = {
    all:      devices.length,
    active:   devices.filter(d => getDeviceStatus(d) === "active").length,
    upcoming: devices.filter(d => d.lastHourmeterMin != null && getMaintStatus(d.lastHourmeterMin / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "upcoming").length,
    overdue:  devices.filter(d => d.lastHourmeterMin != null && getMaintStatus(d.lastHourmeterMin / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "overdue").length,
    stopped:  devices.filter(d => getDeviceStatus(d) !== "active").length,
  };

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const name = (d.displayName ?? d.id).toLowerCase();
    if (search && !name.includes(q) && !d.id.toLowerCase().includes(q)) return false;
    if (tab === "active")   return getDeviceStatus(d) === "active";
    if (tab === "stopped")  return getDeviceStatus(d) !== "active";
    if (tab === "overdue")  return d.lastHourmeterMin != null && getMaintStatus(d.lastHourmeterMin / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "overdue";
    if (tab === "upcoming") return d.lastHourmeterMin != null && getMaintStatus(d.lastHourmeterMin / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "upcoming";
    return true;
  }).sort((a, b) => {
    // Sort: active first, then by hourmeter desc
    const sa = getDeviceStatus(a) === "active" ? 0 : 1;
    const sb = getDeviceStatus(b) === "active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (b.lastHourmeterMin ?? 0) - (a.lastHourmeterMin ?? 0);
  });

  const tabs: { key: FilterTab; label: string; color?: string }[] = [
    { key: "all",      label: `${t.machines.all} (${counts.all})` },
    { key: "active",   label: `Ativas (${counts.active})`,         color: "emerald" },
    { key: "stopped",  label: `Paradas (${counts.stopped})`,       color: "amber" },
    { key: "upcoming", label: `Próx. Rev. (${counts.upcoming})`,   color: "amber" },
    { key: "overdue",  label: `Atrasadas (${counts.overdue})`,     color: "red" },
  ];

  return (
    <Shell>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.machines.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.machines.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-all">
          + {t.machines.register}
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Summary KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-1"><Signal className="w-4 h-4" /><span className="text-xs font-semibold">Ativas</span></div>
            <div className="text-3xl font-bold text-emerald-500">{counts.active}</div>
            <div className="text-[11px] text-muted-foreground">de {devices.length} total</div>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-primary mb-1"><Timer className="w-4 h-4" /><span className="text-xs font-semibold">Horímetro Total</span></div>
            <div className="text-3xl font-bold text-primary">
              {(devices.reduce((s, d) => s + (d.lastHourmeterMin ?? 0), 0) / 60).toFixed(0)}h
            </div>
            <div className="text-[11px] text-muted-foreground">soma da frota</div>
          </div>
          <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-500 mb-1"><Wrench className="w-4 h-4" /><span className="text-xs font-semibold">Próximas</span></div>
            <div className="text-3xl font-bold text-amber-500">{counts.upcoming}</div>
            <div className="text-[11px] text-muted-foreground">&lt; 50h para revisão</div>
          </div>
          <div className="bg-card border border-destructive/20 bg-destructive/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-destructive mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-semibold">Atrasadas</span></div>
            <div className="text-3xl font-bold text-destructive">{counts.overdue}</div>
            <div className="text-[11px] text-muted-foreground">ação imediata</div>
          </div>
        </div>

        {/* Filter tabs + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {tabs.map(tb => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  tab === tb.key
                    ? tb.color === "red"    ? "bg-red-600 text-white"
                    : tb.color === "amber"  ? "bg-amber-500 text-white"
                    : tb.color === "emerald"? "bg-emerald-600 text-white"
                    : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border/50 rounded-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 w-56"
              placeholder="Buscar máquina..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : isError ? (
            <div className="py-16 text-center text-muted-foreground">{t.common.error}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/30">
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Máquina</th>
                  <th className="px-4 py-3 text-left font-medium">Modelo / Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Horímetro</th>
                  <th className="px-4 py-3 text-left font-medium">Progresso Revisão</th>
                  <th className="px-4 py-3 text-right font-medium">Faltam</th>
                  <th className="px-4 py-3 text-left font-medium">Último contato</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">{t.machines.noMachines}</td></tr>
                ) : (
                  filtered.map(d => {
                    const ds = getDeviceStatus(d);
                    const hh = d.lastHourmeterMin != null ? d.lastHourmeterMin / 60 : null;
                    const limitH = d.serviceLimitHours ?? DEFAULT_LIMIT_H;
                    const ms = hh != null ? getMaintStatus(hh, limitH) : null;
                    const rem = hh != null ? limitH - (hh % limitH) : null;
                    const pct = hh != null ? Math.min(100, ((hh % limitH) / limitH) * 100) : 0;

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/devices/${d.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-sm">{d.displayName ?? d.id}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">ID: {d.id}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs">{d.machineModel ?? <span className="text-muted-foreground italic">—</span>}</div>
                          {d.machineType && <div className="text-[10px] text-muted-foreground">{d.machineType}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {hh != null ? `${hh.toFixed(1)}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  ms === "overdue" ? "bg-red-500" : ms === "upcoming" ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {hh != null ? `${(hh % limitH).toFixed(0)}h / ${limitH}h` : "—"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-mono text-sm font-bold ${
                            ms === "overdue" ? "text-red-400" : ms === "upcoming" ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {rem != null ? `${rem.toFixed(0)}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-[11px] text-muted-foreground">
                            {d.lastSeenAt
                              ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true, locale: dateLocale })
                              : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            {ds === "active"
                              ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Ativa</span>
                              : ds === "stopped"
                                ? <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Parada</span>
                                : <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />Sem sinal</span>}
                            {ms && (
                              ms === "overdue"
                                ? <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">ATRASADA</span>
                                : ms === "upcoming"
                                  ? <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">PRÓXIMA</span>
                                  : null
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
