import { useEffect } from "react";
import { Link } from "wouter";
import {
  useListDeviceReportsRuv01, getListDeviceReportsRuv01QueryKey,
  Device, ReportRuv01
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ExternalLink, Eye, Clock, Gauge, Timer,
  MapPin, Zap, Signal, ChevronRight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import bobcatMarker from "@/assets/bobcat-marker.png";

interface DeviceDrawerProps {
  device: Device | null;
  onClose: () => void;
  locale?: "pt" | "en";
}

export function DeviceDrawer({ device, onClose, locale = "pt" }: DeviceDrawerProps) {
  const dateLocale = locale === "pt" ? ptBR : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {device && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-full bg-card border-l border-border/60 flex flex-col shadow-2xl"
          >
            <DrawerContent
              device={device}
              onClose={onClose}
              dateLocale={dateLocale}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerContent({
  device, onClose, dateLocale
}: {
  device: Device;
  onClose: () => void;
  dateLocale: any;
}) {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const isActive = device.lastSeenAt ? new Date(device.lastSeenAt) > tenMinsAgo : false;
  const isMoving = (device.lastSpeedKmh ?? 0) > 2;
  const hourmeterH = device.lastHourmeterMin != null ? (device.lastHourmeterMin / 60).toFixed(1) : null;

  const { data: ruv01Reports } = useListDeviceReportsRuv01(
    device.id,
    { limit: 40 },
    { query: { queryKey: getListDeviceReportsRuv01QueryKey(device.id, { limit: 40 }), refetchInterval: 30000 } }
  );

  const chartData = buildChartData(ruv01Reports ?? []);

  return (
    <>
      {/* Header */}
      <div className={`px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3 ${
        isActive ? "bg-amber-500/5" : "bg-muted/20"
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border p-1.5 ${
            isActive ? "bg-amber-400/15 border-amber-400/40" : "bg-muted border-border"
          }`}>
            <img src={bobcatMarker} alt="Bobcat" className={`w-full h-full object-contain ${isActive ? "" : "opacity-50"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black font-mono text-xl tracking-widest text-foreground">{device.id}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {isActive ? "ATIVA" : "PARADA"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{device.model ?? "Modelo desconhecido"}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-border hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0 mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Stats grid */}
        <div className="p-4 grid grid-cols-2 gap-2.5">
          <StatCell
            icon={<Timer className="w-3.5 h-3.5" />}
            label="Horímetro"
            value={hourmeterH ? `${hourmeterH}h` : "—"}
            accent="blue"
          />
          <StatCell
            icon={<Gauge className="w-3.5 h-3.5" />}
            label="Velocidade"
            value={device.lastSpeedKmh != null ? `${device.lastSpeedKmh} km/h` : "—"}
            accent={isMoving ? "blue" : undefined}
          />
          <StatCell
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Ignição"
            value={device.lastIgnition == null ? "—" : device.lastIgnition ? "Ligada" : "Desligada"}
            accent={device.lastIgnition ? "emerald" : undefined}
          />
          <StatCell
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Último sinal"
            value={device.lastSeenAt
              ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })
              : "Nunca"}
            accent={!isActive && !!device.lastSeenAt ? "amber" : undefined}
            compact
          />
        </div>

        {/* GPS row */}
        {device.lastLat != null && device.lastLon != null && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono bg-muted/30 rounded-xl px-3 py-2">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              <span>{device.lastLat.toFixed(5)}, {device.lastLon.toFixed(5)}</span>
            </div>
          </div>
        )}

        {/* Hourmeter chart */}
        <div className="px-4 pb-3">
          <div className="bg-muted/20 rounded-xl border border-border/30 overflow-hidden">
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Horímetro — últimas leituras</span>
              {chartData.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">{chartData.length} pts</span>
              )}
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                  <defs>
                    <linearGradient id="hmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="10%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "#6b7190" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#6b7190" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${v}h`}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: "#1a1d27", border: "1px solid #3a3f58", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#9aa0b8" }}
                    itemStyle={{ color: "#f59e0b" }}
                    formatter={(v: number) => [`${v.toFixed(1)}h`, "Horímetro"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="hourmeter"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    fill="url(#hmGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#f59e0b" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[80px] flex items-center justify-center text-[11px] text-muted-foreground/50">
                Aguardando dados de horímetro
              </div>
            )}
          </div>
        </div>

        {/* Protocol / transport info */}
        {device.lastTransport && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Signal className="w-3 h-3 shrink-0" />
              <span>Protocolo: <span className="font-mono font-semibold text-foreground uppercase">{device.lastTransport}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-border/40 flex gap-2">
        <Link href={`/devices/${device.id}`} onClick={onClose} className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all">
            Ver detalhes completos
            <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
        {device.lastLat != null && device.lastLon != null && (
          <Link href={`/devices/${device.id}?tab=streetview`} onClick={onClose}>
            <button className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-all" title="Street View">
              <Eye className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>
    </>
  );
}

function StatCell({
  icon, label, value, accent, compact
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "blue" | "emerald" | "amber";
  compact?: boolean;
}) {
  const textClass =
    accent === "blue" ? "text-primary" :
    accent === "emerald" ? "text-emerald-500" :
    accent === "amber" ? "text-amber-500" :
    "text-foreground";

  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <p className={`${compact ? "text-[11px]" : "text-sm"} font-bold leading-tight ${textClass}`}>{value}</p>
    </div>
  );
}

function buildChartData(reports: ReportRuv01[]): { label: string; hourmeter: number }[] {
  return reports
    .filter(r => r.hourmeterMin != null)
    .slice()
    .reverse()
    .map(r => ({
      label: format(new Date(r.receivedAt), "HH:mm"),
      hourmeter: parseFloat(((r.hourmeterMin as number) / 60).toFixed(2)),
    }));
}
