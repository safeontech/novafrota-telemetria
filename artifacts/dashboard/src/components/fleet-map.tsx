import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, LayersControl, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { Device } from "@workspace/api-client-react";
import bobcatMarkerUrl from "@/assets/bobcat-marker.png";

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

function makeMarkerIcon(active: boolean, selected = false): L.DivIcon {
  const ringColor = selected ? "#3b82f6" : active ? "#f59e0b" : "#6b7280";
  const shadowColor = selected
    ? "rgba(59,130,246,0.5)"
    : active
    ? "rgba(245,158,11,0.35)"
    : "rgba(107,114,128,0.35)";
  const opacity = active || selected ? 1 : 0.7;
  const filter = active || selected ? "" : "grayscale(0.6)";
  const size = selected ? 56 : 48;
  const pulse = selected
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(59,130,246,0.4);animation:none;"></div>`
    : "";

  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:#ffffff;border:${selected ? 3 : 2}px solid ${ringColor};
        box-shadow:0 0 0 3px ${shadowColor},0 4px 12px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        padding:4px;opacity:${opacity};filter:${filter};
        cursor:pointer;
      "><img src="${bobcatMarkerUrl}" style="width:100%;height:100%;object-fit:contain;" draggable="false"/></div>
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
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

function DeviceMarker({ device, active, selected, onSelect }: {
  device: Device;
  active: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const icon = useMemo(() => makeMarkerIcon(active, selected), [active, selected]);

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
