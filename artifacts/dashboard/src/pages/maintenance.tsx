import { useState } from "react";
import { useLocation } from "wouter";
import { useListDevices, getListDevicesQueryKey, Device } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Wrench, CheckCircle2, ChevronRight, Search, Plus, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const DEFAULT_LIMIT_H = 500;

function getMaintStatus(hourmeterH: number, limitH: number): "overdue" | "upcoming" | "ok" {
  const pctDone = (hourmeterH % limitH) / limitH;
  const remaining = limitH - (hourmeterH % limitH);
  if (hourmeterH > 0 && hourmeterH % limitH === 0) return "overdue";
  if (remaining <= 0) return "overdue";
  if (remaining <= 50) return "upcoming";
  return "ok";
}

function getRemainingH(hourmeterH: number, limitH: number) {
  const rem = limitH - (hourmeterH % limitH);
  return rem;
}

function getPct(hourmeterH: number, limitH: number) {
  return Math.min(100, ((hourmeterH % limitH) / limitH) * 100);
}

type FilterTab = "all" | "overdue" | "upcoming" | "ok";

export default function Maintenance() {
  const { t, locale } = useI18n();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showAlert, setShowAlert] = useState(true);
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: devices = [], isLoading, isError } = useListDevices(undefined, {
    query: { refetchInterval: 30000, queryKey: getListDevicesQueryKey() },
  });

  const withHourMeter = devices.filter(d => d.lastHourmeterMin != null);
  const overdueMachines  = withHourMeter.filter(d => getMaintStatus(d.lastHourmeterMin! / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "overdue");
  const upcomingMachines = withHourMeter.filter(d => getMaintStatus(d.lastHourmeterMin! / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "upcoming");
  const okMachines       = withHourMeter.filter(d => getMaintStatus(d.lastHourmeterMin! / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H) === "ok");

  const filtered = withHourMeter.filter(d => {
    const q = search.toLowerCase();
    const name = (d.displayName ?? d.id).toLowerCase();
    if (search && !name.includes(q) && !d.id.toLowerCase().includes(q)) return false;
    const ms = getMaintStatus(d.lastHourmeterMin! / 60, d.serviceLimitHours ?? DEFAULT_LIMIT_H);
    if (filter !== "all" && ms !== filter) return false;
    return true;
  }).sort((a, b) => {
    const ra = getRemainingH(a.lastHourmeterMin! / 60, a.serviceLimitHours ?? DEFAULT_LIMIT_H);
    const rb = getRemainingH(b.lastHourmeterMin! / 60, b.serviceLimitHours ?? DEFAULT_LIMIT_H);
    return ra - rb;
  });

  return (
    <Shell>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.maintenance.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.maintenance.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-all">
          <Plus className="w-3.5 h-3.5" />
          {t.maintenance.register}
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Alert banner */}
        {showAlert && overdueMachines.length > 0 && (
          <div className="flex items-center gap-4 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-4">
            <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-destructive">
                {overdueMachines.length} {t.maintenance.alertBanner}
              </div>
              <div className="text-xs text-destructive/70 mt-0.5">{t.maintenance.alertBannerSub}</div>
            </div>
            <button
              onClick={() => setFilter("overdue")}
              className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 transition-colors shrink-0"
            >
              {t.maintenance.alertBannerCta}
            </button>
            <button onClick={() => setShowAlert(false)} className="text-destructive/60 hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary KPI cards */}
        <div className="grid grid-cols-4 gap-3">
          <div
            onClick={() => setFilter("overdue")}
            className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
              filter === "overdue" ? "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/30" : "border-destructive/20 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-semibold text-destructive">{t.maintenance.summary.overdue}</span>
            </div>
            <div className="text-3xl font-bold text-destructive">{overdueMachines.length}</div>
            <div className="text-[11px] text-destructive/70 mt-0.5">{t.maintenance.summary.overdueSub}</div>
          </div>
          <div
            onClick={() => setFilter("upcoming")}
            className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
              filter === "upcoming" ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-amber-500/20 bg-amber-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">{t.maintenance.summary.upcoming}</span>
            </div>
            <div className="text-3xl font-bold text-amber-500">{upcomingMachines.length}</div>
            <div className="text-[11px] text-amber-500/70 mt-0.5">{t.maintenance.summary.upcomingSub}</div>
          </div>
          <div
            onClick={() => setFilter("ok")}
            className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
              filter === "ok" ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-emerald-500/20 bg-emerald-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-500">{t.maintenance.summary.onTime}</span>
            </div>
            <div className="text-3xl font-bold text-emerald-500">{okMachines.length}</div>
            <div className="text-[11px] text-emerald-500/70 mt-0.5">{t.maintenance.summary.onTimeSub}</div>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground">{t.maintenance.summary.cost}</span>
            </div>
            <div className="text-3xl font-bold text-foreground">—</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t.maintenance.summary.costSub}</div>
          </div>
        </div>

        {/* Filter tabs + search */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {[
              { key: "all" as const, label: `${t.maintenance.all} (${withHourMeter.length})` },
              { key: "overdue" as const, label: `${t.maintenance.overdue} (${overdueMachines.length})` },
              { key: "upcoming" as const, label: `${t.maintenance.upcoming} (${upcomingMachines.length})` },
              { key: "ok" as const, label: `${t.maintenance.normal} (${okMachines.length})` },
            ].map(tb => (
              <button
                key={tb.key}
                onClick={() => setFilter(tb.key)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  filter === tb.key
                    ? tb.key === "overdue"  ? "bg-red-600 text-white"
                    : tb.key === "upcoming" ? "bg-amber-500 text-white"
                    : tb.key === "ok"       ? "bg-emerald-600 text-white"
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
              placeholder={t.maintenance.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : isError ? (
            <div className="py-16 text-center text-muted-foreground">{t.common.error}</div>
          ) : withHourMeter.length === 0 ? (
            <div className="py-16 text-center">
              <Wrench className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">{t.maintenance.noData}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.maintenance.noDataSub}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border/30">
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">{t.maintenance.table.id}</th>
                  <th className="px-4 py-3 text-left font-medium">{t.maintenance.table.model}</th>
                  <th className="px-4 py-3 text-right font-medium">{t.maintenance.table.hourMeter}</th>
                  <th className="px-4 py-3 text-right font-medium">{t.maintenance.table.limit}</th>
                  <th className="px-4 py-3 text-left font-medium">{t.maintenance.table.progress}</th>
                  <th className="px-4 py-3 text-right font-medium">{t.maintenance.table.remaining}</th>
                  <th className="px-4 py-3 text-left font-medium">{t.maintenance.table.status}</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">{t.common.noData}</td></tr>
                ) : (
                  filtered.map(d => {
                    const hh = d.lastHourmeterMin! / 60;
                    const limitH = d.serviceLimitHours ?? DEFAULT_LIMIT_H;
                    const ms = getMaintStatus(hh, limitH);
                    const rem = getRemainingH(hh, limitH);
                    const pct = getPct(hh, limitH);

                    return (
                      <tr
                        key={d.id}
                        className={`transition-colors cursor-pointer ${
                          ms === "overdue" ? "bg-destructive/3 hover:bg-destructive/8" : "hover:bg-muted/20"
                        }`}
                        onClick={() => setLocation(`/devices/${d.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-sm">{d.displayName ?? d.id}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{d.id}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs">{d.machineModel ?? <span className="italic text-muted-foreground">—</span>}</div>
                          {d.machineType && <div className="text-[10px] text-muted-foreground">{d.machineType}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-sm font-bold">{hh.toFixed(1)}h</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-xs text-muted-foreground">{limitH}h</span>
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
                            <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% do ciclo</div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-mono text-sm font-bold ${
                            ms === "overdue" ? "text-red-400" : ms === "upcoming" ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {ms === "overdue" ? `+${Math.abs(rem).toFixed(0)}h` : `${rem.toFixed(0)}h`}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {ms === "overdue"
                            ? <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">ATRASADA</span>
                            : ms === "upcoming"
                              ? <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">PRÓXIMA</span>
                              : <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">NORMAL</span>
                          }
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); }}
                            className="text-xs text-primary hover:underline"
                          >
                            {t.maintenance.see}
                          </button>
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
