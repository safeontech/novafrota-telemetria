// Auth-middleware integration tests.
//
// The middleware reads `API_READ_TOKEN` per-request, so we can mutate it
// inline. We boot the same Express app on its own ephemeral port and hit
// it through `fetch` to keep behavior identical to the main suite.

import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, describe, it } from "node:test";

import app from "../src/app.ts";

let baseUrl: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- node http server type churn
let server: any;

const TOKEN = "test-token-do-not-use-in-prod";

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  // Each test is responsible for setting/clearing the token; double-clear
  // in afterEach so a thrown assertion can't leak into the next test.
  delete process.env["API_READ_TOKEN"];
});

describe("auth middleware", () => {
  it("when API_READ_TOKEN is unset, all requests pass (dev mode)", async () => {
    delete process.env["API_READ_TOKEN"];
    const resp = await fetch(`${baseUrl}/devices`);
    assert.equal(resp.status, 200);
  });

  it("healthz is always reachable, even with no token configured", async () => {
    delete process.env["API_READ_TOKEN"];
    const resp = await fetch(`${baseUrl}/healthz`);
    assert.equal(resp.status, 200);
  });

  it("healthz is reachable WITHOUT a bearer header even when a token IS configured", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/healthz`);
    assert.equal(resp.status, 200);
  });

  it("rejects unauthenticated requests with 401 when token is set", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`);
    assert.equal(resp.status, 401);
    const body = (await resp.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  });

  it("rejects malformed Authorization header with 401", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: TOKEN }, // missing 'Bearer ' prefix
    });
    assert.equal(resp.status, 401);
  });

  it("rejects wrong bearer token with 401", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: "Bearer wrong-token-value" },
    });
    assert.equal(resp.status, 401);
  });

  it("rejects an empty bearer with 401", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: "Bearer " },
    });
    assert.equal(resp.status, 401);
  });

  it("accepts the correct bearer token", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(resp.status, 200);
  });

  it("accepts the correct bearer token with a tab/space variant in the prefix", async () => {
    process.env["API_READ_TOKEN"] = TOKEN;
    const resp = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `bearer  ${TOKEN}` }, // lowercase + double space
    });
    assert.equal(resp.status, 200);
  });

  it("returns 500 (server_misconfigured) in production with no token set", async () => {
    delete process.env["API_READ_TOKEN"];
    const previousNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      const resp = await fetch(`${baseUrl}/devices`);
      assert.equal(resp.status, 500);
      const body = (await resp.json()) as { error: string };
      assert.equal(body.error, "server_misconfigured");
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env["NODE_ENV"];
      } else {
        process.env["NODE_ENV"] = previousNodeEnv;
      }
    }
  });
});
