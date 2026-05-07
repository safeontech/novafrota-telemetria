import { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
} from "@vis.gl/react-google-maps";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { Device } from "@workspace/api-client-react";
import bobcatMarkerUrl from "@/assets/bobcat-marker.png";

interface FleetMapProps {
  devices: Device[];
  className?: string;
}

const FALLBACK_CENTER = { lat: -15.78, lng: -47.93 };
const FALLBACK_ZOOM = 4;

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
const MAP_ID = "navortech-fleet-map";

export function FleetMap({ devices, className }: FleetMapProps) {
  const placed = useMemo(
    () => devices.filter((d) => d.lastLat != null && d.lastLon != null),
    [devices],
  );

  const center = useMemo(() => {
    if (placed.length === 0) return FALLBACK_CENTER;
    const sumLat = placed.reduce((acc, d) => acc + (d.lastLat as number), 0);
    const sumLon = placed.reduce((acc, d) => acc + (d.lastLon as number), 0);
    return { lat: sumLat / placed.length, lng: sumLon / placed.length };
  }, [placed]);

  const zoom = placed.length > 1 ? 4 : placed.length === 1 ? 12 : FALLBACK_ZOOM;

  const now = Date.now();
  const tenMinAgo = now - 10 * 60 * 1000;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f2937",
          color: "#f59e0b",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          padding: 16,
          textAlign: "center",
        }}
      >
        Google Maps API key missing.<br />
        Set <code>GOOGLE_API_KEY</code> (or <code>VITE_GOOGLE_MAPS_API_KEY</code>) in Secrets and restart the dashboard workflow.
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId={MAP_ID}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          <FitToFleet placed={placed} />
          {placed.map((d) => {
            const seenMs = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
            const active = seenMs >= tenMinAgo;
            return (
              <DeviceMarker
                key={d.id}
                device={d}
                active={active}
              />
            );
          })}
        </Map>
      </APIProvider>

      {placed.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.75)",
            color: "#374151",
            fontSize: 13,
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

interface FitToFleetProps {
  placed: Device[];
}

/**
 * When the set of placed devices changes, fit the map viewport to them.
 *
 * - Single device: pan to it and use a "follow" zoom (12).
 * - Multiple devices: fitBounds with padding.
 * - Zero devices: do nothing (the wrapper renders the "no devices" overlay).
 *
 * We key off a stable signature of the device IDs so we don't fight the user's
 * pan/zoom on every refetch — only re-fit when the membership actually changes.
 */
function FitToFleet({ placed }: FitToFleetProps) {
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
    if (!map) return;
    if (placed.length === 0) return;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (placed.length === 1) {
      const only = placed[0]!;
      map.panTo({
        lat: only.lastLat as number,
        lng: only.lastLon as number,
      });
      map.setZoom(12);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const d of placed) {
      bounds.extend({
        lat: d.lastLat as number,
        lng: d.lastLon as number,
      });
    }
    map.fitBounds(bounds, 64);
  }, [map, placed, signature]);

  return null;
}

interface DeviceMarkerProps {
  device: Device;
  active: boolean;
}

function DeviceMarker({ device, active }: DeviceMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  const ringColor = active ? "#f59e0b" : "#6b7280";
  const ringGlow = active
    ? "0 0 0 3px rgba(245, 158, 11, 0.35), 0 4px 10px rgba(0,0,0,0.35)"
    : "0 0 0 3px rgba(107, 114, 128, 0.35), 0 4px 10px rgba(0,0,0,0.35)";

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{
          lat: device.lastLat as number,
          lng: device.lastLon as number,
        }}
        onClick={() => setOpen((v) => !v)}
        title={`${device.id} (${active ? "active" : "stale"})`}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#ffffff",
            border: `2px solid ${ringColor}`,
            boxShadow: ringGlow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
            // Stale devices fade out so active ones pop visually.
            opacity: active ? 1 : 0.7,
            filter: active ? undefined : "grayscale(0.6)",
          }}
        >
          <img
            src={bobcatMarkerUrl}
            alt={`Bobcat ${device.id}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        </div>
      </AdvancedMarker>
      {open && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setOpen(false)}
          headerDisabled
        >
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              minWidth: 180,
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
        </InfoWindow>
      )}
    </>
  );
}
