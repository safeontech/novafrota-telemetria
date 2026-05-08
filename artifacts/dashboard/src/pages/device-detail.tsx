import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import {
  useGetDevice, getGetDeviceQueryKey,
  useListDevicePackets, getListDevicePacketsQueryKey,
  useListDeviceReportsRgp, getListDeviceReportsRgpQueryKey,
  useListDeviceReportsRuv00, getListDeviceReportsRuv00QueryKey,
  useListDeviceReportsRuv01, getListDeviceReportsRuv01QueryKey,
  useListDeviceReportsRuv02, getListDeviceReportsRuv02QueryKey,
  useListDeviceReportsRuv03, getListDeviceReportsRuv03QueryKey,
  Packet, ReportRgp, ReportRuv00, ReportRuv01, ReportRuv02, ReportRuv03
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Activity, Navigation2, Clock,
  AlertCircle, FileText, BarChart3, Eye, Timer,
  Gauge, Zap, Wrench
} from "lucide-react";
import { BobcatIcon } from "@/components/icons/BobcatIcon";
import { StreetView } from "@/components/street-view";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";

const VALID_TABS = new Set(["packets", "rgp", "streetview", "ruv00", "ruv01", "ruv02", "ruv03"]);

export default function DeviceDetail({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "pt" ? ptBR : undefined;

  const { data: device, isLoading: isLoadingDevice, isError: isErrorDevice } = useGetDevice(id, {
    query: { enabled: !!id, queryKey: getGetDeviceQueryKey(id), refetchInterval: 15000 }
  });

  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab") ?? "";
  const initialTab = VALID_TABS.has(requestedTab) ? requestedTab : "packets";

  const isActive = device?.lastSeenAt
    ? new Date(device.lastSeenAt) > new Date(Date.now() - 10 * 60 * 1000)
    : false;

  return (
    <Shell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-wider font-mono text-foreground">{id}</h1>
            {device && (
              <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono uppercase">
                {device.model ?? t.machines.unknown}
              </span>
            )}
            {device?.lastIgnition && (
              <span className="text-[11px] bg-primary/15 text-primary px-2 py-0.5 rounded font-bold">
                {t.fleet.device.ignOn}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t.device.detail}</p>
        </div>
        {device?.lastSeenAt && (
          <span className={`text-xs flex items-center gap-1.5 ${isActive ? "text-emerald-500" : "text-amber-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`} />
            {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })}
          </span>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Device summary card */}
        {isLoadingDevice ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : isErrorDevice || !device ? (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{t.common.error}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-xl p-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <StatCell label={locale === "pt" ? "Modelo" : "Model"} value={device.model ?? "—"} mono />
              <StatCell
                label={locale === "pt" ? "Ignição" : "Ignition"}
                value={device.lastIgnition == null ? "—" : device.lastIgnition ? (locale === "pt" ? "Ligada" : "On") : (locale === "pt" ? "Desligada" : "Off")}
                color={device.lastIgnition ? "primary" : "muted"}
              />
              <StatCell
                label={locale === "pt" ? "Velocidade" : "Speed"}
                value={device.lastSpeedKmh != null ? `${device.lastSpeedKmh} km/h` : "—"}
                color={(device.lastSpeedKmh ?? 0) > 2 ? "primary" : "muted"}
              />
              <StatCell
                label={locale === "pt" ? "Horímetro" : "Hour Meter"}
                value={device.lastHourmeterMin != null ? `${(device.lastHourmeterMin / 60).toFixed(1)}h` : "—"}
              />
              <StatCell
                label={locale === "pt" ? "Odômetro" : "Odometer"}
                value={device.lastOdometerM != null ? `${(device.lastOdometerM / 1000).toFixed(1)}km` : "—"}
              />
              <StatCell
                label={locale === "pt" ? "Posição" : "Position"}
                value={device.lastLat != null && device.lastLon != null
                  ? `${device.lastLat.toFixed(4)}, ${device.lastLon.toFixed(4)}`
                  : "—"}
                mono
              />
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 bg-card border border-border/50 flex-wrap gap-0.5">
            <TabsTrigger value="packets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <Activity className="w-3.5 h-3.5" /> {t.device.tabs.packets}
            </TabsTrigger>
            <TabsTrigger value="rgp" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <Navigation2 className="w-3.5 h-3.5" /> {t.device.tabs.rgp}
            </TabsTrigger>
            <TabsTrigger value="streetview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <Eye className="w-3.5 h-3.5" /> {t.device.tabs.streetView}
            </TabsTrigger>
            <TabsTrigger value="ruv01" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <Gauge className="w-3.5 h-3.5" /> {t.device.tabs.ruv01}
            </TabsTrigger>
            <TabsTrigger value="ruv02" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> {t.device.tabs.ruv02}
            </TabsTrigger>
            <TabsTrigger value="ruv03" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <Wrench className="w-3.5 h-3.5" /> {t.device.tabs.ruv03}
            </TabsTrigger>
            <TabsTrigger value="ruv00" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> {t.device.tabs.ruv00}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="packets" className="m-0"><PacketsTab id={id} locale={locale} /></TabsContent>
            <TabsContent value="rgp" className="m-0"><RgpTab id={id} locale={locale} /></TabsContent>
            <TabsContent value="streetview" className="m-0">
              <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold">Street View — {id}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {locale === "pt"
                        ? "Vista ao nível do solo na última posição conhecida. Sites off-road podem não ter imagens."
                        : "Ground-level view at last known position. Off-road job sites may not have imagery."}
                    </p>
                  </div>
                </div>
                {device?.lastLat != null && device?.lastLon != null ? (
                  <StreetView lat={device.lastLat} lon={device.lastLon} label={id} className="h-[520px] w-full" />
                ) : (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                    <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                    <p className="font-medium text-foreground text-sm mb-1">
                      {locale === "pt" ? "Sem posição GPS ainda" : "No GPS position yet"}
                    </p>
                    <p className="text-xs">
                      {locale === "pt" ? "Aguardando o próximo relatório RGP." : "Waiting for next RGP report."}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="ruv00" className="m-0"><Ruv00Tab id={id} locale={locale} /></TabsContent>
            <TabsContent value="ruv01" className="m-0"><Ruv01Tab id={id} locale={locale} /></TabsContent>
            <TabsContent value="ruv02" className="m-0"><Ruv02Tab id={id} locale={locale} /></TabsContent>
            <TabsContent value="ruv03" className="m-0"><Ruv03Tab id={id} locale={locale} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </Shell>
  );
}

function StatCell({ label, value, mono, color }: {
  label: string; value: string; mono?: boolean;
  color?: "primary" | "muted" | "red";
}) {
  const textColor = color === "primary" ? "text-primary font-semibold"
    : color === "red" ? "text-destructive font-semibold"
    : "text-foreground";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : "font-medium"} ${textColor} truncate`}>{value}</p>
    </div>
  );
}

function TableWrap({ title, desc, children, isEmpty, emptyMsg }: {
  title: string; desc?: string; children: React.ReactNode; isEmpty?: boolean; emptyMsg?: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {isEmpty ? (
        <div className="p-10 text-center text-muted-foreground text-sm">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap bg-muted/20">{children}</th>;
}
function Td({ children, mono, className }: { children: React.ReactNode; mono?: boolean; className?: string }) {
  return <td className={`px-4 py-2.5 text-sm text-foreground border-b border-border/15 ${mono ? "font-mono text-xs" : ""} ${className ?? ""}`}>{children}</td>;
}
function TRow({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-muted/10 transition-colors">{children}</tr>;
}

function PacketsTab({ id, locale }: { id: string; locale: string }) {
  const { data: packets, isLoading } = useListDevicePackets(id, { limit: 50 }, {
    query: { refetchInterval: 10000, queryKey: getListDevicePacketsQueryKey(id, { limit: 50 }) }
  });
  const empty = locale === "pt" ? "Nenhum pacote registrado ainda." : "No packets recorded yet.";
  return (
    <TableWrap title={locale === "pt" ? "Feed de Pacotes Brutos" : "Raw Packet Feed"}
      desc={locale === "pt" ? "Datagramas recebidos e status de parse" : "Inbound datagrams and parse status"}
      isEmpty={!isLoading && !packets?.length} emptyMsg={empty}>
      {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
      <table className="w-full">
        <thead><tr><Th>{locale === "pt" ? "Hora" : "Time"}</Th><Th>Status</Th><Th>ASCII</Th></tr></thead>
        <tbody>
          {packets?.map(pkt => (
            <TRow key={pkt.id}>
              <Td mono>{format(new Date(pkt.receivedAt), "dd/MM HH:mm:ss")}</Td>
              <Td>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${pkt.parseStatus === "ok" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                  {pkt.parseStatus}
                </span>
              </Td>
              <Td mono className="max-w-xl truncate text-muted-foreground">{pkt.ascii?.trim() || "<vazio>"}</Td>
            </TRow>
          ))}
        </tbody>
      </table>}
    </TableWrap>
  );
}

function RgpTab({ id, locale }: { id: string; locale: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRgp(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRgpQueryKey(id, { limit: 50 }) }
  });
  const empty = locale === "pt" ? "Nenhum relatório RGP registrado." : "No RGP reports recorded.";
  return (
    <TableWrap title={locale === "pt" ? "Histórico de Posição (RGP)" : "Position History (RGP)"}
      desc={locale === "pt" ? "Localização e status básico" : "Location and basic status"}
      isEmpty={!isLoading && !reports?.length} emptyMsg={empty}>
      {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
      <table className="w-full">
        <thead><tr>
          <Th>{locale === "pt" ? "Hora" : "Time"}</Th>
          <Th>{locale === "pt" ? "Localização" : "Location"}</Th>
          <Th>{locale === "pt" ? "Velocidade" : "Speed"}</Th>
          <Th>{locale === "pt" ? "Ignição" : "Ignition"}</Th>
          <Th>{locale === "pt" ? "Alimentação" : "Main Pwr"}</Th>
          <Th>HDOP</Th>
        </tr></thead>
        <tbody>
          {reports?.map(r => (
            <TRow key={r.id}>
              <Td mono>{format(new Date(r.receivedAt), "dd/MM HH:mm:ss")}</Td>
              <Td mono>{r.lat?.toFixed(5)}, {r.lon?.toFixed(5)}</Td>
              <Td>{r.speedKmh} km/h</Td>
              <Td>{r.ignition !== null ? (r.ignition ? <span className="text-primary font-medium">{locale === "pt" ? "Ligada" : "ON"}</span> : <span className="text-muted-foreground">{locale === "pt" ? "Desligada" : "OFF"}</span>) : "—"}</Td>
              <Td>{r.mainPower !== null ? (r.mainPower ? <span className="text-emerald-500">{locale === "pt" ? "Conectada" : "Connected"}</span> : <span className="text-amber-500">{locale === "pt" ? "Desconectada" : "Disconnected"}</span>) : "—"}</Td>
              <Td>{r.hdop ?? "—"}</Td>
            </TRow>
          ))}
        </tbody>
      </table>}
    </TableWrap>
  );
}

function Ruv01Tab({ id, locale }: { id: string; locale: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv01(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv01QueryKey(id, { limit: 50 }) }
  });
  const empty = locale === "pt" ? "Nenhum relatório RUV01 registrado." : "No RUV01 reports recorded.";
  return (
    <TableWrap title={locale === "pt" ? "Telemetria ao Vivo (RUV01)" : "Live Telemetry (RUV01)"}
      desc={locale === "pt" ? "Métricas operacionais detalhadas" : "Detailed operational metrics"}
      isEmpty={!isLoading && !reports?.length} emptyMsg={empty}>
      {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
      <table className="w-full">
        <thead><tr>
          <Th>{locale === "pt" ? "Hora" : "Time"}</Th>
          <Th>RPM</Th>
          <Th>{locale === "pt" ? "Temp Motor" : "Eng Temp"}</Th>
          <Th>{locale === "pt" ? "Combustível" : "Fuel"}</Th>
          <Th>{locale === "pt" ? "Bateria" : "Battery"}</Th>
          <Th>{locale === "pt" ? "Horímetro" : "Hourmeter"}</Th>
          <Th>{locale === "pt" ? "Odômetro" : "Odometer"}</Th>
        </tr></thead>
        <tbody>
          {reports?.map(r => (
            <TRow key={r.id}>
              <Td mono>{format(new Date(r.receivedAt), "dd/MM HH:mm:ss")}</Td>
              <Td>{r.rpm ?? "—"}</Td>
              <Td className={r.engineTempC != null && r.engineTempC > 100 ? "text-destructive font-semibold" : ""}>
                {r.engineTempC != null ? `${r.engineTempC}°C` : "—"}
              </Td>
              <Td>
                {r.fuelPct != null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${r.fuelPct < 15 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, r.fuelPct)}%` }} />
                    </div>
                    <span className={r.fuelPct < 15 ? "text-destructive font-semibold" : ""}>{r.fuelPct}%</span>
                  </div>
                ) : "—"}
              </Td>
              <Td>{r.mainSupplyV != null ? `${r.mainSupplyV}V` : "—"}</Td>
              <Td>{r.hourmeterMin != null ? `${(r.hourmeterMin / 60).toFixed(1)}h` : "—"}</Td>
              <Td>{r.odometerM != null ? `${(r.odometerM / 1000).toFixed(1)}km` : "—"}</Td>
            </TRow>
          ))}
        </tbody>
      </table>}
    </TableWrap>
  );
}

function Ruv02Tab({ id, locale }: { id: string; locale: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv02(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv02QueryKey(id, { limit: 50 }) }
  });
  const chartData = [...(reports || [])].reverse().map(r => ({
    time: format(new Date(r.receivedAt), "HH:mm"),
    distancia: r.distanceM ? r.distanceM / 1000 : 0,
    combustivel: r.fuelConsumedDecilitres ? r.fuelConsumedDecilitres / 10 : 0,
  }));
  const empty = locale === "pt" ? "Nenhum relatório RUV02 registrado." : "No RUV02 reports recorded.";

  return (
    <div className="space-y-4">
      {reports && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "distancia", label: locale === "pt" ? "Distância por relatório (km)" : "Distance per report (km)", color: "var(--primary)" },
            { key: "combustivel", label: locale === "pt" ? "Combustível consumido (L)" : "Fuel consumed (L)", color: "hsl(var(--chart-3))" },
          ].map(chart => (
            <div key={chart.key} className="bg-card border border-border/50 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{chart.label}</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }} />
                  <Area type="monotone" dataKey={chart.key} stroke={chart.color} fill={`url(#grad-${chart.key})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
      <TableWrap title={locale === "pt" ? "Agregados (RUV02)" : "Aggregates (RUV02)"}
        desc={locale === "pt" ? "Resumos de viagem e totais operacionais" : "Trip summaries and operational totals"}
        isEmpty={!isLoading && !reports?.length} emptyMsg={empty}>
        {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
        <table className="w-full">
          <thead><tr>
            <Th>{locale === "pt" ? "Hora" : "Time"}</Th>
            <Th>{locale === "pt" ? "Tempo Viagem" : "Travel Time"}</Th>
            <Th>{locale === "pt" ? "Distância" : "Distance"}</Th>
            <Th>{locale === "pt" ? "Combustível" : "Fuel"}</Th>
            <Th>Inertial</Th>
            <Th>Coasting</Th>
          </tr></thead>
          <tbody>
            {reports?.map(r => (
              <TRow key={r.id}>
                <Td mono>{format(new Date(r.receivedAt), "dd/MM HH:mm:ss")}</Td>
                <Td>{r.travelTimeMin != null ? `${r.travelTimeMin}min` : "—"}</Td>
                <Td>{r.distanceM != null ? `${(r.distanceM / 1000).toFixed(2)}km` : "—"}</Td>
                <Td>{r.fuelConsumedDecilitres != null ? `${(r.fuelConsumedDecilitres / 10).toFixed(1)}L` : "—"}</Td>
                <Td>{r.inertialSec != null ? `${r.inertialSec}s` : "—"}</Td>
                <Td>{r.coastingSec != null ? `${r.coastingSec}s` : "—"}</Td>
              </TRow>
            ))}
          </tbody>
        </table>}
      </TableWrap>
    </div>
  );
}

function Ruv03Tab({ id, locale }: { id: string; locale: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv03(id, { limit: 50 }, {
    query: { refetchInterval: 15000, queryKey: getListDeviceReportsRuv03QueryKey(id, { limit: 50 }) }
  });
  const empty = locale === "pt" ? "Nenhum relatório RUV03 registrado." : "No RUV03 reports recorded.";
  return (
    <TableWrap title={locale === "pt" ? "Detalhe do Motor (RUV03)" : "Engine Detail (RUV03)"}
      desc={locale === "pt" ? "Snapshot detalhado do motor" : "Deep engine metrics snapshot"}
      isEmpty={!isLoading && !reports?.length} emptyMsg={empty}>
      {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
      <table className="w-full">
        <thead><tr>
          <Th>{locale === "pt" ? "Hora" : "Time"}</Th>
          <Th>{locale === "pt" ? "Velocidade" : "Speed"}</Th>
          <Th>RPM</Th>
          <Th>{locale === "pt" ? "Torque" : "Load/Torque"}</Th>
          <Th>{locale === "pt" ? "Acelerador" : "Accel %"}</Th>
          <Th>{locale === "pt" ? "Freio Motor" : "Brake %"}</Th>
          <Th>Flags</Th>
        </tr></thead>
        <tbody>
          {reports?.map(r => (
            <TRow key={r.id}>
              <Td mono>{format(new Date(r.receivedAt), "dd/MM HH:mm:ss")}</Td>
              <Td>{r.speedKmh ?? "—"} {r.speedKmh != null ? "km/h" : ""}</Td>
              <Td>{r.rpm ?? "—"}</Td>
              <Td>{r.engineTorquePct != null ? `${r.engineTorquePct}%` : "—"}</Td>
              <Td>{r.acceleratorPct != null ? `${r.acceleratorPct}%` : "—"}</Td>
              <Td>{r.engineBrakePct != null ? `${r.engineBrakePct}%` : "—"}</Td>
              <Td>
                <div className="flex gap-1 flex-wrap">
                  {r.cruiseControl && <Badge variant="outline" className="text-[10px] px-1 h-4 border-primary text-primary">CC</Badge>}
                  {r.parkingBrake && <Badge variant="outline" className="text-[10px] px-1 h-4 border-amber-500 text-amber-500">PARK</Badge>}
                  {r.serviceBrake && <Badge variant="outline" className="text-[10px] px-1 h-4 border-destructive text-destructive">BRK</Badge>}
                  {r.clutch && <Badge variant="outline" className="text-[10px] px-1 h-4">CL</Badge>}
                  {!r.cruiseControl && !r.parkingBrake && !r.serviceBrake && !r.clutch && <span className="text-muted-foreground">—</span>}
                </div>
              </Td>
            </TRow>
          ))}
        </tbody>
      </table>}
    </TableWrap>
  );
}

function Ruv00Tab({ id, locale }: { id: string; locale: string }) {
  const { data: reports, isLoading } = useListDeviceReportsRuv00(id, { limit: 50 }, {
    query: { refetchInterval: 60000, queryKey: getListDeviceReportsRuv00QueryKey(id, { limit: 50 }) }
  });
  const empty = locale === "pt" ? "Nenhum relatório RUV00 registrado." : "No RUV00 reports recorded.";
  return (
    <TableWrap title={locale === "pt" ? "Identificação do Dispositivo (RUV00)" : "Device Identification (RUV00)"}
      desc={locale === "pt" ? "Informações de firmware e hardware" : "Firmware and hardware info"}
      isEmpty={!isLoading && !reports?.length} emptyMsg={empty}>
      {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
      <table className="w-full">
        <thead><tr>
          <Th>{locale === "pt" ? "Hora" : "Time"}</Th>
          <Th>Firmware</Th><Th>Board</Th><Th>Script</Th><Th>ICCID</Th>
          <Th>{locale === "pt" ? "Principal (V)" : "Main (V)"}</Th>
          <Th>{locale === "pt" ? "Backup (V)" : "Backup (V)"}</Th>
        </tr></thead>
        <tbody>
          {reports?.map(r => (
            <TRow key={r.id}>
              <Td mono>{format(new Date(r.receivedAt), "dd/MM HH:mm:ss")}</Td>
              <Td mono>{r.firmware ?? "—"}</Td>
              <Td mono>{r.board ?? "—"}</Td>
              <Td mono>{r.script ?? "—"}</Td>
              <Td mono className="text-[10px]">{r.iccid ?? "—"}</Td>
              <Td>{r.mainSupplyV ?? "—"}</Td>
              <Td>{r.backupBatteryV ?? "—"}</Td>
            </TRow>
          ))}
        </tbody>
      </table>}
    </TableWrap>
  );
}
