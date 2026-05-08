import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Bridge Replit secret GOOGLE_API_KEY → import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// so the dashboard's client bundle can reach the key without forcing the user
// to rename the secret to a VITE_-prefixed variant. We only fall back when the
// canonical Vite env var is absent — that way, if anyone later sets
// VITE_GOOGLE_MAPS_API_KEY directly (via shell, .env, or Replit secret), Vite's
// normal env resolution wins and we don't shadow it with an empty string.
const googleMapsFallbackKey = process.env.VITE_GOOGLE_MAPS_API_KEY
  ? null
  : process.env.GOOGLE_API_KEY ?? null;

if (!process.env.VITE_GOOGLE_MAPS_API_KEY && !googleMapsFallbackKey) {
  console.warn(
    "[dashboard] No Google Maps API key found in VITE_GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY — fleet map will fail to load tiles.",
  );
}

export default defineConfig({
  base: basePath,
  define: googleMapsFallbackKey
    ? {
        "import.meta.env.VITE_GOOGLE_MAPS_API_KEY":
          JSON.stringify(googleMapsFallbackKey),
      }
    : {},
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  optimizeDeps: {
    include: ["react", "react-dom", "leaflet", "react-leaflet"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "leaflet", "react-leaflet"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
