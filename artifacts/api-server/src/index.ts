import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// HOST controls the bind interface.
//   - In Replit dev: unset → defaults to 0.0.0.0 so the preview proxy can reach it.
//   - On the VPS in production: set to 127.0.0.1 in the systemd unit so the
//     listener is not directly reachable from the public internet — a TLS
//     reverse proxy (Caddy/nginx) is responsible for terminating external
//     traffic before it ever hits this process.
const host = process.env["HOST"] ?? "0.0.0.0";

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");
});
