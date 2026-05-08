import { useState } from "react";
import { Link } from "wouter";
import { useListDevices, getListDevicesQueryKey, Device } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Wrench, Clock, Plus,
  Search, CheckCircle2, AlertCircle, ChevronRight, Timer
} from "lucide-react";
import { BobcatIcon } from "@/components/icons/BobcatIcon";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

const MAINTENANCE_LIMIT_H = 500;

type MaintStatus = "overdue" | "upcoming" | "ok";

function getMaintStatus(hourmeterH: number): MaintStatus {
  const remaining = MAINTENANCE_LIMIT_H - (hourmeterH % MAINTENANCE_LIMIT_H);
  if (remaining <= 0) return "overdue";
  if (remaining <= 50) return "upcoming";
  return "ok";
}

export default function Maintenance() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "upcoming" | "ok">("all");
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: devices, isLoading, isError } = useListDevices(undefined, {
    query: { refetchInterval: 30000, queryKey: getListDevicesQueryKey() },
  });

  const withHourMeter = (devices ?? []).filter(d => d.lastHourmeterMin != null);
  const overdueMachines = withHourMeter.filter(d => getMaintStatus(d.lastHourmeterMin! / 60) === "overdue");
  const upcomingMachines = withHourMeter.filter(d => getMaintStatus(d.lastHourmeterMin! / 60) === "upcoming");

  const filtered = withHourMeter.filter(d => {
    const matchSearch = search === "" ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.model ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    const status = getMaintStatus(d.lastHourmeterMin! / 60);
    if (filter !== "all" && status !== filter) return false;
    return true;
  }).sort((a, b) => {
    const ra = MAINTENANCE_LIMIT_H - ((a.lastHourmeterMin! / 60) % MAINTENANCE_LIMIT_H);
    const rb = MAINTENANCE_LIMIT_H - ((b.lastHourmeterMin! / 60) % MAINTENANCE_LIMIT_H);
    return ra - rb;
  });

  return (
    <Shell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.maintenance.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.maintenance.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
          <Plus className="w-3.5 h-3.5" />
          {t.maintenance.register}
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Alert banner */}
        {overdueMachines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3"
          >
            <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-sm text-destructive font-medium">{t.maintenance.alertBanner}</p>
            <span className="ml-auto text-sm font-bold text-destructive shrink-0">{overdueMachines.length}</span>
          </motion.div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.maintenance.status.overdue, count: overdueMachines.length, color: "red", icon: <AlertCircle className="w-4 h-4" /> },
            { label: t.maintenance.status.upcoming, count: upcomingMachines.length, color: "amber", icon: <Clock className="w-4 h-4" /> },
            { label: t.maintenance.status.ok, count: withHourMeter.length - overdueMachines.length - upcomingMachines.length, color: "green", icon: <CheckCircle2 className="w-4 h-4" /> },
          ].map((item, i) => (
            <div key={i} className={`bg-card border rounded-xl p-4 ${
              item.color === "red" ? "border-destructive/30 bg-destructive/5" :
              item.color === "amber" ? "border-amber-500/30 bg-amber-500/5" :
              "border-emerald-500/20 bg-emerald-500/5"
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                item.color === "red" ? "text-destructive" :
                item.color === "amber" ? "text-amber-500" : "text-emerald-500"
              }`}>
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <p className={`text-2xl font-bold ${
                item.color === "red" ? "text-destructive" :
                item.color === "amber" ? "text-amber-500" : "text-emerald-500"
              }`}>{item.count}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="pl-8 pr-4 py-1.5 text-xs bg-muted/40 border border-border/40 rounded-lg outline-none focus:border-primary/50 w-48 placeholder:text-muted-foreground/60 transition-all"
                placeholder={t.maintenance.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 ml-auto">
              {(["all", "overdue", "upcoming", "ok"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {f === "all" ? t.maintenance.all :
                   f === "overdue" ? t.maintenance.overdue :
                   f === "upcoming" ? t.maintenance.upcoming :
                   t.maintenance.normal}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : isError ? (
            <div className="p-10 text-center text-muted-foreground text-sm">{t.common.error}</div>
          ) : withHourMeter.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center text-muted-foreground">
              <Wrench className="w-10 h-10 opacity-30 mb-3" />
              <p className="font-medium text-foreground text-sm mb-1">{t.maintenance.noData}</p>
              <p className="text-xs max-w-xs">{t.maintenance.noDataSub}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    {[
                      t.maintenance.table.id,
                      t.maintenance.table.model,
                      t.maintenance.table.hourMeter,
                      t.maintenance.table.limit,
                      t.maintenance.table.remaining,
                      t.maintenance.table.progress,
                      t.maintenance.table.status,
                      "",
                    ].map((col, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((device, index) => (
                    <MaintRow key={device.id} device={device} index={index} t={t} />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                        {t.common.noData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function MaintRow({ device, index, t }: {
  device: Device; index: number;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const hourmeterH = device.lastHourmeterMin! / 60;
  const cycleH = hourmeterH % MAINTENANCE_LIMIT_H;
  const remaining = MAINTENANCE_LIMIT_H - cycleH;
  const nextRevision = Math.ceil(hourmeterH / MAINTENANCE_LIMIT_H) * MAINTENANCE_LIMIT_H;
  const progress = Math.min((cycleH / MAINTENANCE_LIMIT_H) * 100, 100);
  const status = getMaintStatus(hourmeterH);

  const statusConfig = {
    overdue: { label: t.maintenance.status.overdue, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
    upcoming: { label: t.maintenance.status.upcoming, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
    ok: { label: t.maintenance.status.ok, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  };
  const sc = statusConfig[status];

  const progressColor = status === "overdue" ? "bg-destructive" : status === "upcoming" ? "bg-amber-500" : "bg-primary";

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04 }}
      className="border-b border-border/20 hover:bg-muted/10 transition-colors"
    >
      <td className="px-4 py-3">
        <span className="font-bold text-sm font-mono text-primary">{device.id}</span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{device.model ?? t.machines.unknown}</td>
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-foreground flex items-center gap-1">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          {hourmeterH.toFixed(1)}h
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{nextRevision}h</td>
      <td className="px-4 py-3">
        <span className={`text-sm font-bold ${sc.color}`}>
          {status === "overdue" ? `+${Math.abs(remaining).toFixed(1)}h` : `${remaining.toFixed(1)}h`}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">{progress.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${sc.bg} ${sc.color}`}>
          {sc.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link href={`/devices/${device.id}`}>
          <button className="flex items-center gap-1 text-[11px] text-primary hover:underline">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </td>
    </motion.tr>
  );
}
