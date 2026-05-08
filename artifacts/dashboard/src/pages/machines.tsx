import { Link } from "wouter";
import { useListDevices, getListDevicesQueryKey, Device } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { BobcatColorIcon, BobcatIcon } from "@/components/icons/BobcatIcon";
import {
  Clock, Gauge, Timer, MapPin, ChevronRight,
  AlertCircle, Search, Plus, Zap, Signal
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";
import bobcatMarker from "@/assets/bobcat-marker.png";

export default function Machines() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: devices, isLoading, isError } = useListDevices(undefined, {
    query: { refetchInterval: 15000, queryKey: getListDevicesQueryKey() },
  });

  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

  const filtered = (devices ?? []).filter(d =>
    search === "" ||
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    (d.model ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = filtered.filter(d => d.lastSeenAt && new Date(d.lastSeenAt) > tenMinsAgo).length;

  return (
    <Shell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.machines.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.machines.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20">
          <Plus className="w-3.5 h-3.5" />
          {t.machines.register}
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Search + summary */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border/50 rounded-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
              placeholder={t.fleet.roster.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {!isLoading && !isError && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-emerald-500" />
                <span><span className="font-semibold text-foreground">{activeCount}</span> {t.machines.active.toLowerCase()}</span>
              </span>
              <span className="text-border">·</span>
              <span><span className="font-semibold text-foreground">{filtered.length}</span> {t.common.of} {devices?.length ?? 0} total</span>
            </div>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-sm">{t.common.error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-5">
              <BobcatColorIcon className="w-20 h-14 opacity-30" />
            </div>
            <p className="font-semibold text-foreground text-base mb-1">{t.machines.noMachines}</p>
            <p className="text-sm max-w-xs text-center">{t.machines.noMachinesSub}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((device, index) => (
              <MachineCard key={device.id} device={device} index={index} t={t} dateLocale={dateLocale} tenMinsAgo={tenMinsAgo} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function MachineCard({ device, index, t, dateLocale, tenMinsAgo }: {
  device: Device; index: number;
  t: ReturnType<typeof useI18n>["t"];
  dateLocale: any;
  tenMinsAgo: Date;
}) {
  const isActive = device.lastSeenAt ? new Date(device.lastSeenAt) > tenMinsAgo : false;
  const isMoving = (device.lastSpeedKmh ?? 0) > 2;
  const hourmeterH = device.lastHourmeterMin != null ? (device.lastHourmeterMin / 60).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 300, damping: 24 }}
    >
      <Link href={`/devices/${device.id}`}>
        <div className={`group bg-card border rounded-2xl cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
          isActive
            ? "border-border/50 hover:border-primary/30 hover:shadow-primary/10"
            : "border-border/30 opacity-80 hover:opacity-100 hover:shadow-black/10"
        }`}>

          {/* ── Hero visual area ─────────────────────────────────────── */}
          <div className={`relative h-40 flex items-end justify-between px-5 pb-4 overflow-hidden ${
            isActive
              ? "bg-gradient-to-br from-primary/20 via-primary/8 to-transparent"
              : "bg-gradient-to-br from-muted/60 via-muted/30 to-transparent"
          }`}>
            {/* Background grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "16px 16px" }}
            />

            {/* Machine silhouette — large Bobcat icon */}
            <div className="absolute right-3 bottom-0 w-32 h-24 flex items-end justify-end">
              <BobcatColorIcon
                className={`w-full h-full drop-shadow-lg transition-all duration-300 group-hover:scale-105 ${
                  isActive ? "" : "opacity-50 grayscale"
                }`}
              />
            </div>

            {/* Left side: ID + model */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}>
                  {isActive ? t.machines.active : t.machines.stopped}
                </span>
                {device.lastIgnition && (
                  <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">
                    {t.fleet.device.ignOn}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black tracking-widest font-mono text-foreground">{device.id}</h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{device.model ?? t.machines.unknown}</p>
            </div>

            {/* Bobcat marker image in top-right corner (small badge) */}
            {isActive && (
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <img src={bobcatMarker} alt="" className="w-5 h-5 object-contain" />
              </div>
            )}
          </div>

          {/* ── Stats grid ───────────────────────────────────────────── */}
          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <StatBox
                label={t.machines.hourMeter}
                value={hourmeterH != null ? `${hourmeterH}h` : "—"}
                icon={<Timer className="w-3 h-3" />}
              />
              <StatBox
                label={t.machines.speed}
                value={device.lastSpeedKmh != null ? `${device.lastSpeedKmh} km/h` : "—"}
                icon={<Gauge className="w-3 h-3" />}
                highlight={isMoving}
              />
              <StatBox
                label={t.machines.ignition}
                value={device.lastIgnition == null ? "—" : device.lastIgnition ? t.machines.on : t.machines.off}
                icon={<Zap className="w-3 h-3" />}
                highlight={!!device.lastIgnition}
                highlightColor="emerald"
              />
              <StatBox
                label={t.machines.lastSeen}
                value={device.lastSeenAt
                  ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })
                  : t.fleet.device.neverSeen}
                icon={<Clock className="w-3 h-3" />}
                warn={!isActive && !!device.lastSeenAt}
                compact
              />
            </div>

            {/* GPS coords */}
            {device.lastLat != null && device.lastLon != null && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono bg-muted/30 rounded-lg px-2.5 py-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {device.lastLat.toFixed(5)}, {device.lastLon.toFixed(5)}
              </div>
            )}

            {/* View details */}
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <span className="text-[11px] text-muted-foreground">{t.common.version}</span>
              <div className={`flex items-center gap-1 text-[12px] font-semibold transition-all group-hover:gap-2 ${
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              }`}>
                {t.machines.viewDetails}
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function StatBox({ label, value, icon, highlight, highlightColor = "primary", warn, compact }: {
  label: string; value: string; icon?: React.ReactNode;
  highlight?: boolean; highlightColor?: "primary" | "emerald";
  warn?: boolean; compact?: boolean;
}) {
  const textClass = highlight
    ? highlightColor === "emerald" ? "text-emerald-500" : "text-primary"
    : warn ? "text-amber-500" : "text-foreground";
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <p className={`${compact ? "text-[11px]" : "text-sm"} font-bold leading-tight ${textClass}`}>{value}</p>
    </div>
  );
}
