import { useState, useEffect, useRef } from "react";
import { Shell } from "@/components/layout/Shell";
import { useI18n } from "@/lib/i18n";
import { useListDevices, getListDevicesQueryKey } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <div style="width:10px;height:10px;border-radius:50%;background:white;opacity:0.9;"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const iconOnline = makeIcon("#22c55e");
const iconAttention = makeIcon("#f59e0b");
const iconOffline = makeIcon("#ef4444");

function getDeviceStatus(d: any): "online" | "attention" | "offline" {
  if (!d.lastReportAt) return "offline";
  const mins = (Date.now() - new Date(d.lastReportAt).getTime()) / 60000;
  if (mins < 10) return "online";
  if (mins < 60) return "attention";
  return "offline";
}

function MapFlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lon], 14, { duration: 1 }); }, [lat, lon]);
  return null;
}

export default function GridPage() {
  const { t, locale } = useI18n();
  const { data: devices = [] } = useListDevices(undefined, { query: { refetchInterval: 30000, queryKey: getListDevicesQueryKey() } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const positioned = devices.filter(d => d.lastLat && d.lastLon);
  const online = devices.filter(d => getDeviceStatus(d) === "online").length;
  const attention = devices.filter(d => getDeviceStatus(d) === "attention").length;
  const offline = devices.filter(d => getDeviceStatus(d) === "offline").length;

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const name = (d.displayName ?? d.id).toLowerCase();
    return name.includes(q) || d.id.toLowerCase().includes(q);
  });

  const selectedDevice = devices.find(d => d.id === selectedId);

  const statusLabel = (d: any) => {
    const s = getDeviceStatus(d);
    if (s === "online") return <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t.grid.status.online}</span>;
    if (s === "attention") return <span className="flex items-center gap-1 text-amber-500 text-xs font-medium"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{t.grid.status.attention}</span>;
    return <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{t.grid.status.offline}</span>;
  };

  const center: [number, number] = positioned.length > 0
    ? [positioned[0].lastLat!, positioned[0].lastLon!]
    : [-23.5, -46.6];

  return (
    <Shell>
      <div className="p-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.grid.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t.grid.subtitle} · {devices.length} ativos rastreados</span>
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
          + {t.grid.newMachine}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="px-6 pb-4 grid grid-cols-4 gap-4">
        {[
          { label: t.grid.trackers, value: devices.length, sub: "total cadastrado" },
          { label: t.grid.online, value: online, sub: "comunicando agora", color: "text-emerald-500" },
          { label: t.grid.alerts, value: attention, sub: "requer atenção", color: "text-amber-500" },
          { label: t.grid.noContact, value: offline, sub: t.grid.noContactSub, color: "text-red-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${kpi.color ?? "text-foreground"}`}>{kpi.value}</div>
            <div className="text-sm font-medium text-foreground mt-0.5">{kpi.label}</div>
            <div className="text-xs text-muted-foreground">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main split panel */}
      <div className="px-6 pb-6 flex gap-4 flex-1" style={{ height: "calc(100vh - 220px)" }}>
        {/* Tracker list */}
        <div className="w-[480px] min-w-[420px] bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">{t.grid.listTitle}</span>
            <span className="text-xs text-muted-foreground">{devices.length} ativos</span>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.grid.searchPlaceholder}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left font-medium">ID / Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Último</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                    className={`border-t border-border cursor-pointer transition-colors ${
                      selectedId === d.id ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-primary text-xs">{d.displayName ?? d.id}</div>
                      {d.machineModel && <div className="text-xs text-muted-foreground">{d.machineModel}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {d.lastReportAt
                        ? formatDistanceToNow(new Date(d.lastReportAt), { addSuffix: true, locale: locale === "pt" ? ptBR : undefined })
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">{statusLabel(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">{t.grid.mapTitle}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              tempo real · {new Date().toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex-1">
            <MapContainer center={center} zoom={9} style={{ width: "100%", height: "100%" }} zoomControl={true}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri"
              />
              {selectedDevice?.lastLat && selectedDevice?.lastLon && (
                <MapFlyTo lat={selectedDevice.lastLat} lon={selectedDevice.lastLon} />
              )}
              {positioned.map(d => (
                <Marker
                  key={d.id}
                  position={[d.lastLat!, d.lastLon!]}
                  icon={getDeviceStatus(d) === "online" ? iconOnline : getDeviceStatus(d) === "attention" ? iconAttention : iconOffline}
                  eventHandlers={{ click: () => setSelectedId(d.id) }}
                >
                  <Popup>
                    <div className="text-sm font-semibold">{d.displayName ?? d.id}</div>
                    {d.machineModel && <div className="text-xs text-gray-500">{d.machineModel}</div>}
                    {d.lastHourmeterMin != null && (
                      <div className="text-xs mt-1">Horímetro: {(d.lastHourmeterMin / 60).toFixed(1)}h</div>
                    )}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </Shell>
  );
}
