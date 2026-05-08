import { useState } from "react";
import { Link } from "wouter";
import {
  useListDevices, getListDevicesQueryKey,
  useListFleetRecentPackets, getListFleetRecentPacketsQueryKey,
  Device, Packet
} from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FleetMap } from "@/components/fleet-map";
import {
  Activity, Clock, MapPin, Navigation2, AlertTriangle, AlertCircle,
  CheckCircle2, ChevronRight, ServerCrash, Signal,
  Gauge, Timer, Wrench, Search, Download
} from "lucide-react";
import { BobcatIcon } from "@/components/icons/BobcatIcon";
import bobcatMarker from "@/assets/bobcat-marker.png";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

export default function FleetOverview() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "stopped">("all");

  const { data: devices, isLoading: isLoadingDevices, isError: isErrorDevices } = useListDevices(
    undefined,
    { query: { refetchInterval: 15000, queryKey: getListDevicesQueryKey() } }
  );

  const { data: recentPackets, isLoading: isLoadingPackets } = useListFleetRecentPackets(
    { limit: 60 },
    { query: { refetchInterval: 10000, queryKey: getListFleetRecentPacketsQueryKey({ limit: 60 }) } }
  );

  const now = Date.now();
  const tenMinsAgo = new Date(now - 10 * 60 * 1000);
  const thirtyMinsAgo = new Date(now - 30 * 60 * 1000);

  const activeDevices = devices?.filter(d => d.lastSeenAt && new Date(d.lastSeenAt) > tenMinsAgo) ?? [];
  const totalDevices = devices?.length ?? 0;
  const totalHourmeter = devices?.reduce((sum, d) => sum + (d.lastHourmeterMin ?? 0), 0) ?? 0;
  const failedPackets = recentPackets?.filter(p => p.parseStatus !== "ok").length ?? 0;
  const lastPacket = recentPackets?.[0];

  const filteredDevices = (devices ?? []).filter(d => {
    const matchSearch = search === "" ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.model ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "active") return d.lastSeenAt && new Date(d.lastSeenAt) > tenMinsAgo;
    if (filter === "stopped") return !d.lastSeenAt || new Date(d.lastSeenAt) <= tenMinsAgo;
    return true;
  });

  const dateLocale = locale === "pt" ? ptBR : undefined;

  const kpis = [
    {
      label: t.fleet.kpi.activeFleet,
      value: `${activeDevices.length}`,
      sub: `${t.common.of} ${totalDevices} ${t.common.online}`,
      color: activeDevices.length > 0 ? "green" : "muted",
      icon: <Signal className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.systemHealth,
      value: failedPackets === 0 ? t.fleet.status.optimal : failedPackets < 10 ? t.fleet.status.degraded : t.fleet.status.critical,
      sub: failedPackets > 0 ? `${failedPackets} erros` : "100% OK",
      color: failedPackets === 0 ? "green" : failedPackets < 10 ? "amber" : "red",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.totalHourMeter,
      value: `${(totalHourmeter / 60).toFixed(0)}h`,
      sub: t.fleet.kpi.totalHourMeterSub,
      color: "blue",
      icon: <Timer className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.upcomingRevision,
      value: "—",
      sub: t.fleet.kpi.upcomingRevisionSub,
      color: "amber",
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      label: t.fleet.kpi.overdueRevision,
      value: "—",
      sub: t.fleet.kpi.overdueRevisionSub,
      color: "red",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  ] as const;

  const colorMap = {
    green: { bg: "bg-emerald-500/10 border-emerald-500/20", icon: "text-emerald-500", text: "text-emerald-500" },
    blue: { bg: "bg-primary/10 border-primary/20", icon: "text-primary", text: "text-primary" },
    amber: { bg: "bg-amber-500/10 border-amber-500/20", icon: "text-amber-500", text: "text-amber-500" },
    red: { bg: "bg-destructive/10 border-destructive/20", icon: "text-destructive", text: "text-destructive" },
    muted: { bg: "bg-muted border-border", icon: "text-muted-foreground", text: "text-foreground" },
  } as const;

  return (
    <Shell>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.fleet.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.fleet.subtitle}
            {lastPacket?.receivedAt && (
              <> · {t.fleet.updatedAgo} {formatDistanceToNow(new Date(lastPacket.receivedAt), { addSuffix: true, locale: dateLocale })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all">
            <Download className="w-3.5 h-3.5" />
            {t.fleet.export}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((kpi, i) => {
            const c = colorMap[kpi.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`bg-card border rounded-xl p-4 cursor-default hover:border-border transition-all duration-200 hover:-translate-y-0.5 ${
                  kpi.color === "red" ? "border-destructive/30 bg-destructive/5" :
                  kpi.color === "amber" ? "border-amber-500/30 bg-amber-500/5" :
                  kpi.color === "green" ? "border-emerald-500/20 bg-emerald-500/5" :
                  "border-border/50"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${c.bg}`}>
                  <span className={c.icon}>{kpi.icon}</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{kpi.label}</p>
                <p className={`text-2xl font-bold tracking-tight leading-none ${
                  kpi.color === "muted" ? "text-foreground" : c.text
                }`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
              </motion.div>
            );
          })}
        </div>

        {/* ── Split: Roster (left) + Map (right) ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Fleet Roster */}
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl flex flex-col overflow-hidden">
            {/* Roster header */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t.fleet.roster.title}</h2>
                <p className="text-[11px] text-muted-foreground">{t.fleet.roster.subtitle}</p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                {filteredDevices.length}
              </Badge>
            </div>

            {/* Search + filter */}
            <div className="px-3 py-2 border-b border-border/20 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/40 rounded-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                  placeholder={t.fleet.roster.searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {(["all", "active", "stopped"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {f === "all" ? t.fleet.roster.all : f === "active" ? t.fleet.roster.active : t.fleet.roster.stopped}
                  </button>
                ))}
              </div>
            </div>

            {/* Device list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/20 min-h-0 max-h-[520px]">
              {isLoadingDevices ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : isErrorDevices ? (
                <div className="p-10 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm">{t.fleet.roster.loadError}</p>
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
                  <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mb-3">
                    <BobcatIcon className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-medium text-foreground text-sm mb-1">{t.fleet.roster.noData}</p>
                  <p className="text-xs max-w-xs">{t.fleet.roster.noDataSub}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredDevices.map((device, index) => (
                    <DeviceRow key={device.id} device={device} index={index} t={t} dateLocale={dateLocale} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Map + Packet feed stacked */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Live Map */}
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden flex-1">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t.fleet.map.title}</h2>
                    <p className="text-[11px] text-muted-foreground">{t.fleet.map.subtitle}</p>
                  </div>
                </div>
                {devices && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {devices.filter(d => d.lastLat != null && d.lastLon != null).length} {t.fleet.map.placed}
                  </Badge>
                )}
              </div>
              <FleetMap devices={devices ?? []} className="h-[320px] w-full" />
            </div>

            {/* Packet Feed */}
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden h-[220px] flex flex-col">
              <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{t.fleet.packetFeed.title}</span>
                {!isLoadingPackets && recentPackets && (
                  <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                    {recentPackets.length}
                  </Badge>
                )}
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] divide-y divide-border/15">
                {isLoadingPackets ? (
                  <div className="p-3 space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
                  </div>
                ) : !recentPackets?.length ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">{t.fleet.packetFeed.noPackets}</div>
                ) : (
                  recentPackets.map(packet => (
                    <PacketRow key={packet.id} packet={packet} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function DeviceRow({ device, index, t, dateLocale }: {
  device: Device; index: number;
  t: ReturnType<typeof useI18n>["t"];
  dateLocale: any;
}) {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const isActive = device.lastSeenAt ? new Date(device.lastSeenAt) > tenMinsAgo : false;
  const isMoving = (device.lastSpeedKmh ?? 0) > 2;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      <Link href={`/devices/${device.id}`}>
        <div className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors cursor-pointer group relative">
          {/* Ignition indicator stripe */}
          {device.lastIgnition && (
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r" />
          )}

          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border overflow-hidden p-1 ${
            isActive
              ? "bg-amber-400/20 border-amber-400/50"
              : "bg-muted border-border"
          }`}>
            <img
              src={bobcatMarker}
              alt="Bobcat"
              className={`w-full h-full object-contain ${isActive ? "" : "grayscale opacity-50"}`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-[13px] font-mono tracking-wider text-foreground">{device.id}</span>
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono uppercase">
                {device.model ?? t.machines.unknown}
              </span>
              {device.lastIgnition && (
                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">
                  {t.fleet.device.ignOn}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className={`flex items-center gap-1 ${!isActive ? "text-amber-500" : ""}`}>
                <Clock className="w-3 h-3" />
                {device.lastSeenAt
                  ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })
                  : t.fleet.device.neverSeen}
              </span>
              {device.lastSpeedKmh != null && (
                <span className={`flex items-center gap-1 ${isMoving ? "text-primary font-medium" : ""}`}>
                  <Gauge className="w-3 h-3" />
                  {device.lastSpeedKmh} km/h
                </span>
              )}
              {device.lastHourmeterMin != null && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {(device.lastHourmeterMin / 60).toFixed(1)} {t.fleet.device.hrs}
                </span>
              )}
            </div>
          </div>

          {/* Status badge + arrow */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isActive
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {isActive ? t.machines.active : t.machines.stopped}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PacketRow({ packet }: { packet: Packet }) {
  const isOk = packet.parseStatus === "ok";
  return (
    <div className={`px-3 py-2 ${isOk ? "" : "bg-destructive/5"}`}>
      <div className="flex items-center justify-between mb-0.5 opacity-60">
        <span className="text-muted-foreground text-[10px]">{format(new Date(packet.receivedAt), "HH:mm:ss")}</span>
        {packet.deviceId ? (
          <Link href={`/devices/${packet.deviceId}`}>
            <span className="text-primary hover:underline font-bold text-[10px]">{packet.deviceId}</span>
          </Link>
        ) : (
          <span className="text-[10px]">{packet.peer}</span>
        )}
      </div>
      <div className={`truncate text-[11px] ${isOk ? "text-foreground/70" : "text-destructive/80"}`}>
        {packet.ascii?.trim() || "<binary>"}
      </div>
    </div>
  );
}
