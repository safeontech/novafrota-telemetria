import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { Device } from "@workspace/api-client-react";

interface FleetMapProps {
  devices: Device[];
  className?: string;
  selectedDeviceId?: string;
  onSelectDevice?: (id: string) => void;
}

const FALLBACK_CENTER: [number, number] = [-15.78, -47.93];
const FALLBACK_ZOOM = 4;

const TILE_LAYERS = {
  osm: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  esriStreet: {
    label: "Esri Streets",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
    maxZoom: 20,
  },
  esriSatellite: {
    label: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 20,
  },
  esriTopo: {
    label: "Esri Topo",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
    maxZoom: 20,
  },
} as const;

type MarkerStatus = "active" | "stopped" | "overdue" | "upcoming" | "offline";

const STATUS_COLORS: Record<MarkerStatus, { bg: string; border: string; glow: string }> = {
  active:   { bg: "#059669", border: "#10b981", glow: "rgba(16,185,129,0.45)" },
  upcoming: { bg: "#d97706", border: "#f59e0b", glow: "rgba(245,158,11,0.45)" },
  overdue:  { bg: "#dc2626", border: "#ef4444", glow: "rgba(239,68,68,0.45)" },
  stopped:  { bg: "#4b5563", border: "#6b7280", glow: "rgba(107,114,128,0.35)" },
  offline:  { bg: "#374151", border: "#4b5563", glow: "rgba(75,85,99,0.25)" },
};

function bobcatPaths(fill: string) {
  return `<rect x="2" y="50" width="76" height="12" rx="6" fill="${fill}" opacity="0.95"/>
    <circle cx="72" cy="56" r="5.5" fill="${fill}"/>
    <circle cx="8" cy="56" r="5.5" fill="${fill}"/>
    <circle cx="28" cy="56" r="3" fill="${fill}" opacity="0.6"/>
    <circle cx="44" cy="56" r="3" fill="${fill}" opacity="0.6"/>
    <path d="M62 50 L62 17 L28 17 L18 38" stroke="${fill}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95"/>
    <rect x="32" y="19" width="38" height="31" rx="3" fill="${fill}"/>
    <rect x="32" y="13" width="38" height="8" rx="4" fill="${fill}"/>
    <rect x="12" y="34" width="9" height="14" rx="2" fill="${fill}" opacity="0.88"/>
    <path d="M2 37 L16 37 L21 50 L2 50 Z" fill="${fill}" opacity="0.9"/>
    <rect x="1" y="48.5" width="21" height="3" rx="1.5" fill="${fill}"/>`;
}

function makeMarkerIcon(status: MarkerStatus, selected = false): L.DivIcon {
  const { bg, border, glow } = STATUS_COLORS[status];
  const w = selected ? 52 : 44;
  const bodyH = Math.round(w * 0.88);
  const tipH = Math.round(w * 0.32);
  const totalH = bodyH + tipH;
  const iconW = Math.round(w * 0.62);
  const iconH = Math.round(iconW * 0.8);

  const pulseRing = selected
    ? `<div style="position:absolute;top:-7px;left:-7px;right:-7px;bottom:${tipH - 4}px;border-radius:12px;border:2px solid ${border};opacity:0.55;pointer-events:none;"></div>`
    : "";

  const svg = `<svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:${iconW}px;height:${iconH}px;display:block;">${bobcatPaths("white")}</svg>`;

  return L.divIcon({
    html: `<div style="position:relative;width:${w}px;height:${totalH}px;filter:drop-shadow(0 4px 10px ${glow}) drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
      ${pulseRing}
      <div style="
        position:absolute;top:0;left:0;
        width:${w}px;height:${bodyH}px;
        background:linear-gradient(160deg,${border}ee 0%,${bg} 100%);
        border-radius:12px;
        border:${selected ? 2.5 : 1.5}px solid ${border};
        display:flex;align-items:center;justify-content:center;
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.2);
      ">${svg}</div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:${Math.round(w * 0.28)}px solid transparent;
        border-right:${Math.round(w * 0.28)}px solid transparent;
        border-top:${tipH}px solid ${bg};
        filter:drop-shadow(0 3px 3px rgba(0,0,0,0.3));
      "></div>
    </div>`,
    className: "",
    iconSize: [w, totalH],
    iconAnchor: [w / 2, totalH],
    popupAnchor: [0, -totalH],
  });
}

export function FleetMap({ devices, className, selectedDeviceId, onSelectDevice }: FleetMapProps) {
  const placed = useMemo(
    () => devices.filter((d) => d.lastLat != null && d.lastLon != null),
    [devices],
  );

  const center = useMemo((): [number, number] => {
    if (placed.length === 0) return FALLBACK_CENTER;
    const sumLat = placed.reduce((acc, d) => acc + (d.lastLat as number), 0);
    const sumLon = placed.reduce((acc, d) => acc + (d.lastLon as number), 0);
    return [sumLat / placed.length, sumLon / placed.length];
  }, [placed]);

  const zoom = placed.length > 1 ? FALLBACK_ZOOM : placed.length === 1 ? 12 : FALLBACK_ZOOM;

  const now = Date.now();
  const tenMinAgo = now - 10 * 60 * 1000;

  return (
    <div className={className} style={{ position: "relative" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <FitToFleet placed={placed} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name={TILE_LAYERS.osm.label}>
            <TileLayer
              url={TILE_LAYERS.osm.url}
              attribution={TILE_LAYERS.osm.attribution}
              maxZoom={TILE_LAYERS.osm.maxZoom}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name={TILE_LAYERS.esriStreet.label}>
            <TileLayer
              url={TILE_LAYERS.esriStreet.url}
              attribution={TILE_LAYERS.esriStreet.attribution}
              maxZoom={TILE_LAYERS.esriStreet.maxZoom}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name={TILE_LAYERS.esriSatellite.label}>
            <TileLayer
              url={TILE_LAYERS.esriSatellite.url}
              attribution={TILE_LAYERS.esriSatellite.attribution}
              maxZoom={TILE_LAYERS.esriSatellite.maxZoom}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name={TILE_LAYERS.esriTopo.label}>
            <TileLayer
              url={TILE_LAYERS.esriTopo.url}
              attribution={TILE_LAYERS.esriTopo.attribution}
              maxZoom={TILE_LAYERS.esriTopo.maxZoom}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {placed.map((d) => {
          const seenMs = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
          const active = seenMs >= tenMinAgo;
          const selected = d.id === selectedDeviceId;
          return (
            <DeviceMarker
              key={d.id}
              device={d}
              active={active}
              selected={selected}
              onSelect={onSelectDevice}
            />
          );
        })}
      </MapContainer>

      {placed.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            color: "#f59e0b",
            fontSize: 13,
            fontFamily: "ui-monospace, monospace",
            pointerEvents: "none",
            zIndex: 500,
          }}
        >
          No devices with known position
        </div>
      )}
    </div>
  );
}

function FitToFleet({ placed }: { placed: Device[] }) {
  const map = useMap();
  const lastSignatureRef = useRef<string>("");

  const signature = useMemo(
    () =>
      placed
        .map((d) => d.id)
        .sort()
        .join(","),
    [placed],
  );

  useEffect(() => {
    if (placed.length === 0) return;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (placed.length === 1) {
      map.setView(
        [placed[0]!.lastLat as number, placed[0]!.lastLon as number],
        12,
      );
      return;
    }

    const bounds = L.latLngBounds(
      placed.map((d) => [d.lastLat as number, d.lastLon as number]),
    );
    map.fitBounds(bounds, { padding: [64, 64] });
  }, [map, placed, signature]);

  return null;
}

const DEFAULT_SERVICE_LIMIT_H = 500;

function getMarkerStatus(device: Device, active: boolean): MarkerStatus {
  if (!device.lastSeenAt) return "offline";
  if (!active) return "stopped";
  if (device.lastHourmeterMin != null) {
    const hh = device.lastHourmeterMin / 60;
    const limit = (device.serviceLimitHours as number | undefined) ?? DEFAULT_SERVICE_LIMIT_H;
    const remaining = limit - (hh % limit);
    if (remaining <= 0 || hh % limit === 0) return "overdue";
    if (remaining <= 50) return "upcoming";
  }
  return "active";
}

function DeviceMarker({ device, active, selected, onSelect }: {
  device: Device;
  active: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const status = useMemo(() => getMarkerStatus(device, active), [device, active]);
  const icon = useMemo(() => makeMarkerIcon(status, selected), [status, selected]);

  return (
    <Marker
      position={[device.lastLat as number, device.lastLon as number]}
      icon={icon}
      title={`${device.id} (${active ? "active" : "stale"})`}
    >
      <Popup minWidth={190} maxWidth={240}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            color: "#111827",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            <Link
              href={`/devices/${device.id}`}
              style={{ color: "#b45309", textDecoration: "none" }}
            >
              {device.id}
            </Link>{" "}
            <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 500 }}>
              ({device.model})
            </span>
          </div>

          <div style={{ fontSize: 11, color: "#4b5563" }}>
            {(device.lastLat as number).toFixed(5)},{" "}
            {(device.lastLon as number).toFixed(5)}
          </div>

          {device.lastSpeedKmh != null && (
            <div style={{ fontSize: 11, marginTop: 2 }}>
              Speed: <strong>{device.lastSpeedKmh} km/h</strong>
              {device.lastIgnition != null && (
                <>
                  {"  · IGN "}
                  <strong
                    style={{
                      color: device.lastIgnition ? "#b45309" : "#6b7280",
                    }}
                  >
                    {device.lastIgnition ? "ON" : "OFF"}
                  </strong>
                </>
              )}
            </div>
          )}

          {device.lastSeenAt && (
            <div style={{ fontSize: 11, marginTop: 2, color: "#6b7280" }}>
              {formatDistanceToNow(new Date(device.lastSeenAt), {
                addSuffix: true,
              })}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <Link
              href={`/devices/${device.id}`}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "5px 8px",
                borderRadius: 4,
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 11,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid #fde68a",
              }}
            >
              Details
            </Link>
            <Link
              href={`/devices/${device.id}?tab=streetview`}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "5px 8px",
                borderRadius: 4,
                background: "#f59e0b",
                color: "#111827",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid #d97706",
              }}
            >
              Street View
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
