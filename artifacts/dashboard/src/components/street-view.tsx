import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  useApiIsLoaded,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapPin, AlertCircle } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

const SEARCH_RADIUS_M = 250;

interface StreetViewProps {
  lat: number;
  lon: number;
  label?: string;
  className?: string;
}

/**
 * Embedded Google Street View panorama centered on the device's last known
 * position. Many Bobcat job-sites are off-road (quarries, construction, yards)
 * where Street View imagery doesn't exist, so we use StreetViewService.getPanorama
 * to look for the nearest panorama within SEARCH_RADIUS_M and render a clear
 * fallback when none is found.
 */
export function StreetView({ lat, lon, label, className }: StreetViewProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <FallbackPanel
        title="Google Maps API key missing"
        message="Set GOOGLE_API_KEY (or VITE_GOOGLE_MAPS_API_KEY) in Secrets and restart the dashboard."
        className={className}
      />
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["geometry"]}>
      <StreetViewInner lat={lat} lon={lon} label={label} className={className} />
    </APIProvider>
  );
}

interface InnerProps extends StreetViewProps {}

type ViewStatus = "loading" | "ok" | "no_imagery" | "error";

function StreetViewInner({ lat, lon, label, className }: InnerProps) {
  const apiLoaded = useApiIsLoaded();
  // Force-load the geometry library so computeHeading is actually available
  // (otherwise heading silently falls back to 0).
  const geometryLib = useMapsLibrary("geometry");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [errorDetail, setErrorDetail] = useState<string>("");

  useEffect(() => {
    if (!apiLoaded) return;
    if (!containerRef.current) return;

    // Guard against stale callbacks: if lat/lon changes while a getPanorama
    // request is in flight, ignore the old response.
    let cancelled = false;

    setStatus("loading");
    setErrorDetail("");

    const svc = new google.maps.StreetViewService();
    svc.getPanorama(
      {
        location: { lat, lng: lon },
        radius: SEARCH_RADIUS_M,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data, statusCode) => {
        if (cancelled) return;

        if (statusCode === google.maps.StreetViewStatus.ZERO_RESULTS) {
          setStatus("no_imagery");
          return;
        }
        if (
          statusCode !== google.maps.StreetViewStatus.OK ||
          !data ||
          !data.location?.latLng
        ) {
          setErrorDetail(String(statusCode ?? "UNKNOWN"));
          setStatus("error");
          return;
        }

        const target = data.location.latLng;
        // Heading is best-effort: orient the panorama to look toward the
        // device's actual coords. Falls back to 0 if geometry lib hasn't
        // loaded yet.
        const heading = geometryLib?.spherical
          ? geometryLib.spherical.computeHeading(
              target,
              new google.maps.LatLng(lat, lon),
            )
          : 0;

        if (panoRef.current) {
          panoRef.current.setPano(data.location.pano!);
          panoRef.current.setPov({ heading, pitch: 0 });
          panoRef.current.setVisible(true);
        } else {
          panoRef.current = new google.maps.StreetViewPanorama(
            containerRef.current!,
            {
              pano: data.location.pano!,
              pov: { heading, pitch: 0 },
              addressControl: false,
              fullscreenControl: true,
              motionTracking: false,
              motionTrackingControl: false,
              zoomControl: true,
              panControl: true,
              linksControl: true,
            },
          );
        }

        setStatus("ok");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [apiLoaded, geometryLib, lat, lon]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div
        ref={containerRef}
        data-streetview-canvas
        style={{ width: "100%", height: "100%", background: "#1f2937" }}
      />
      {status === "loading" && (
        <Overlay>Loading street view…</Overlay>
      )}
      {status === "error" && (
        <Overlay>
          <AlertCircle
            aria-hidden="true"
            style={{ width: 28, height: 28, color: "#ef4444", marginBottom: 8 }}
          />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Street View temporarily unavailable
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              maxWidth: 360,
              lineHeight: 1.4,
            }}
          >
            Google's Street View service returned an error
            {errorDetail ? ` (${errorDetail})` : ""}. This is usually a quota,
            authentication, or network issue — not a problem with the device.
          </div>
        </Overlay>
      )}
      {status === "no_imagery" && (
        <Overlay>
          <AlertCircle
            aria-hidden="true"
            style={{ width: 28, height: 28, color: "#f59e0b", marginBottom: 8 }}
          />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            No street view available within {SEARCH_RADIUS_M} m
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              maxWidth: 360,
              lineHeight: 1.4,
            }}
          >
            {label ? <strong>{label}</strong> : "This device"} is at{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </code>{" "}
            — Google has no street-level imagery in this area. This is normal
            for off-road job sites (quarries, yards, construction interiors).
          </div>
          <a
            href={`https://www.google.com/maps?q=${lat},${lon}`}
            target="_blank"
            rel="noreferrer"
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              background: "#f59e0b",
              color: "#111827",
              fontWeight: 600,
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            <MapPin aria-hidden="true" style={{ width: 14, height: 14 }} />
            Open in Google Maps
          </a>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(17, 24, 39, 0.9)",
        color: "#f3f4f6",
        textAlign: "center",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function FallbackPanel({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1f2937",
        color: "#f59e0b",
        fontFamily: "ui-monospace, monospace",
        padding: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{message}</div>
    </div>
  );
}
