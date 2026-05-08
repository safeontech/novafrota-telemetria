import { Link } from "wouter";
import { useListDevices, getListDevicesQueryKey, Device } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Construction, Clock, Gauge, Timer, MapPin, ChevronRight,
  AlertCircle, Navigation2, Plus, Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";

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

  return (
    <Shell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.machines.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.machines.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
          <Plus className="w-3.5 h-3.5" />
          {t.machines.register}
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Navigation2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border/50 rounded-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
            placeholder={t.fleet.roster.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-sm">{t.common.error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
              <Construction className="w-7 h-7 opacity-40" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">{t.machines.noMachines}</p>
            <p className="text-xs max-w-xs text-center">{t.machines.noMachinesSub}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/devices/${device.id}`}>
        <div className={`group bg-card border rounded-xl p-4 cursor-pointer hover:border-border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
          isActive ? "border-border/50" : "border-border/30 opacity-75"
        }`}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                isActive ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
              }`}>
                <Construction className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm font-mono tracking-wider text-foreground">{device.id}</p>
                <p className="text-[11px] text-muted-foreground">{device.model ?? t.machines.unknown}</p>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isActive
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {isActive ? t.machines.active : t.machines.stopped}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.machines.hourMeter}</p>
              <p className="text-base font-bold text-foreground mt-0.5">{hourmeterH != null ? `${hourmeterH}h` : "—"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.machines.speed}</p>
              <p className={`text-base font-bold mt-0.5 ${isMoving ? "text-primary" : "text-foreground"}`}>
                {device.lastSpeedKmh != null ? `${device.lastSpeedKmh} km/h` : "—"}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.machines.ignition}</p>
              <p className={`text-sm font-semibold mt-0.5 ${device.lastIgnition ? "text-emerald-500" : "text-muted-foreground"}`}>
                {device.lastIgnition == null ? "—" : device.lastIgnition ? t.machines.on : t.machines.off}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.machines.lastSeen}</p>
              <p className={`text-[11px] font-medium mt-0.5 ${!isActive ? "text-amber-500" : "text-foreground"}`}>
                {device.lastSeenAt
                  ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })
                  : t.fleet.device.neverSeen}
              </p>
            </div>
          </div>

          {/* GPS */}
          {device.lastLat != null && device.lastLon != null && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
              <MapPin className="w-3 h-3" />
              <span className="font-mono">{device.lastLat.toFixed(5)}, {device.lastLon.toFixed(5)}</span>
            </div>
          )}

          {/* View details link */}
          <div className="flex items-center justify-end text-[11px] text-primary font-medium group-hover:gap-2 gap-1 transition-all mt-1">
            <span>{t.machines.viewDetails}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
