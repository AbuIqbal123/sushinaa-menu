import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../src/cms/auth";

// The dev server's own URL when run with `next dev --hostname 0.0.0.0`.
const BOUND = "http://0.0.0.0:3005/api/admin/session";
const req = (headers: Record<string, string>, url = BOUND) =>
  new Request(url, { method: "POST", headers });

test("sameOrigin accepts the host the browser used", () => {
  assert.ok(
    sameOrigin(
      req({ origin: "http://localhost:3005", host: "localhost:3005" }),
    ),
  );
  assert.ok(
    sameOrigin(
      req({ origin: "http://192.168.1.199:3005", host: "192.168.1.199:3005" }),
    ),
  );
  assert.ok(
    sameOrigin(req({ origin: "http://0.0.0.0:3005", host: "0.0.0.0:3005" })),
  );
});

test("sameOrigin rejects foreign, missing or malformed origins", () => {
  const host = "localhost:3005";
  assert.equal(
    sameOrigin(req({ origin: "https://evil.example", host })),
    false,
  );
  assert.equal(
    sameOrigin(req({ origin: "http://localhost:3006", host })),
    false,
  );
  assert.equal(
    sameOrigin(req({ origin: "http://evil.localhost:3005", host })),
    false,
  );
  assert.equal(sameOrigin(req({ host })), false);
  assert.equal(sameOrigin(req({ origin: "null", host })), false);
  assert.equal(sameOrigin(req({ origin: "not a url", host })), false);
});

test("sameOrigin rejects when there is no Host to compare against", () => {
  assert.equal(sameOrigin(req({ origin: "http://localhost:3005" })), false);
});

test("sameOrigin prefers x-forwarded-host (Vercel)", () => {
  const url = "https://sushinaa.vercel.app/api/admin/session";
  const vercel = {
    host: "sushinaa.vercel.app",
    "x-forwarded-host": "sushinaa.vercel.app",
  };
  assert.ok(
    sameOrigin(req({ ...vercel, origin: "https://sushinaa.vercel.app" }, url)),
  );
  assert.equal(
    sameOrigin(req({ ...vercel, origin: "https://evil.example" }, url)),
    false,
  );
  assert.ok(
    sameOrigin(
      req({
        origin: "https://menu.example",
        host: "internal:3000",
        "x-forwarded-host": "menu.example",
      }),
    ),
  );
  assert.equal(
    sameOrigin(
      req({
        origin: "http://internal:3000",
        host: "internal:3000",
        "x-forwarded-host": "menu.example",
      }),
    ),
    false,
  );
});
