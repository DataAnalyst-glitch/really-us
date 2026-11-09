import { createHash, timingSafeEqual } from "node:crypto";
import { createBlobsStorage, type BlobStoreLike } from "./blobs-storage.js";
import { demoKeyOk, handleApproveDraft, handleConsoleState, handleCreateDraft, handleReset } from "./console.js";
import { handleApproveOutbreak, handleCase, handleReport, handleSenderLookup, handleVerify, type Deps } from "./handlers.js";
import { createMemoryStorage } from "./storage.js";
import { chooseBackend, probeRuntime } from "./storage-select.js";
import type { ApiResult, Storage } from "./types.js";

// Thin HTTP adapter. It parses the request, checks the method and key, calls an existing
// handler and returns the handler's status and JSON body. It contains no verdict logic.

export interface RequestInfo {
  body: unknown;
  query: URLSearchParams;
  params: Record<string, string>;
  headers: Headers;
}

export interface Route {
  method: "GET" | "POST";
  auth?: "api_key" | "demo_key"; // api_key: X-API-Key must equal API_KEY. demo_key: X-Demo-Key must equal DEMO_KEY.
  run: (deps: Deps, info: RequestInfo) => Promise<ApiResult>;
}

// Minimal shape of the Netlify Functions (v2) context and config, so no extra dependency is needed.
export interface FunctionContext {
  params: Record<string, string>;
}

type Env = Record<string, string | undefined>;

// Storage backend. On Netlify it is always Netlify Blobs (memory does not persist between invocations);
// locally and in tests it is memory. See api/src/storage-select.ts for the rule and the evidence.
// If Blobs cannot be used the request fails with SERVER_ERROR. There is no silent fallback to memory.
let memoryStorage: Storage | undefined;
let storageOverride: Storage | undefined; // tests only

async function getStorage(env: Env): Promise<Storage> {
  if (storageOverride) return storageOverride;
  if (chooseBackend(probeRuntime(env)) === "memory") {
    memoryStorage ??= createMemoryStorage();
    return memoryStorage;
  }
  // A Blobs store is made per request: the runtime sets the Blobs context (site, token) on every
  // invocation, so a store kept from an earlier invocation could hold an expired token.
  const { getStore } = await import("@netlify/blobs");
  return createBlobsStorage(getStore({ name: "really-us-demo", consistency: "strong" }) as unknown as BlobStoreLike);
}

export function resetStorageForTests(): void {
  storageOverride = undefined;
  memoryStorage = createMemoryStorage();
}
export function forgetStorageForTests(): void {
  storageOverride = undefined;
  memoryStorage = undefined;
}
export function useStorageForTests(storage: Storage): void {
  storageOverride = storage;
}

export function describeError(err: unknown): [string, string] {
  if (!(err instanceof Error)) return ["unknown", ""];
  return [err.name, String(err.message).replace(/\s+/g, " ").slice(0, 300)];
}

function json(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
}

const fail = (status: number, error: string, extra: Record<string, string> = {}) =>
  json(status, { success: false, demo_data: true, error }, extra);

function sameKey(supplied: string | null, expected: string | undefined): boolean {
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function serve(req: Request, params: Record<string, string>, route: Route, env: Env = process.env): Promise<Response> {
  try {
    if (req.method !== route.method) return fail(405, "METHOD_NOT_ALLOWED", { allow: route.method });

    if (route.auth === "api_key" && !sameKey(req.headers.get("x-api-key"), env.API_KEY)) {
      return fail(401, "API_KEY_REQUIRED");
    }

    if (route.auth === "demo_key" && !demoKeyOk({ env: { DEMO_KEY: env.DEMO_KEY } }, req.headers.get("x-demo-key"))) {
      return fail(401, "DEMO_KEY_REQUIRED");
    }

    let body: unknown = undefined;
    if (route.method === "POST") {
      try {
        body = JSON.parse(await req.text());
      } catch {
        return fail(400, "INVALID_JSON");
      }
    }

    const deps: Deps = { storage: await getStorage(env), env: { DEMO_DATA_ONLY: env.DEMO_DATA_ONLY, DEMO_KEY: env.DEMO_KEY } };
    const result = await route.run(deps, {
      body,
      query: new URL(req.url).searchParams,
      params,
      headers: req.headers,
    });
    return json(result.status, result.body);
  } catch (err) {
    // The caller gets only SERVER_ERROR. The log gets the error name and message so a failure is visible.
    // Never log the request body, headers, keys or a stack trace.
    console.error("function_error", ...describeError(err));
    return fail(500, "SERVER_ERROR");
  }
}

// ---- routes: each calls one existing handler ------------------------------------

export const verifyRoute: Route = { method: "POST", run: (deps, i) => handleVerify(deps, i.body) };

export const sendersRoute: Route = {
  method: "GET",
  run: (deps, i) => handleSenderLookup(deps, { company_id: i.query.get("company_id") ?? undefined, sender_hash: i.params.hash }),
};

export const reportsRoute: Route = { method: "POST", auth: "api_key", run: (deps, i) => handleReport(deps, i.body) };

export const casesRoute: Route = { method: "POST", auth: "api_key", run: (deps, i) => handleCase(deps, i.body) };

export const approveRoute: Route = {
  method: "POST",
  auth: "demo_key",
  run: (deps, i) => {
    const b = typeof i.body === "object" && i.body !== null && !Array.isArray(i.body) ? (i.body as Record<string, unknown>) : {};
    return handleApproveOutbreak(deps, {
      demo_key: i.headers.get("x-demo-key") ?? undefined,
      outbreak_id: i.params.id,
      confirmed: b.confirmed,
      idempotency_key: b.idempotency_key,
    });
  },
};

// ---- Trust Console routes (all need X-Demo-Key) ----------------------------------------

const bodyOf = (i: RequestInfo): Record<string, unknown> =>
  typeof i.body === "object" && i.body !== null && !Array.isArray(i.body) ? (i.body as Record<string, unknown>) : {};
const demoKeyOf = (i: RequestInfo) => i.headers.get("x-demo-key") ?? undefined;

export const consoleStateRoute: Route = {
  method: "GET",
  auth: "demo_key",
  run: (deps, i) => handleConsoleState(deps, { demo_key: demoKeyOf(i) }),
};

export const resetRoute: Route = {
  method: "POST",
  auth: "demo_key",
  run: (deps, i) => handleReset(deps, { demo_key: demoKeyOf(i), confirmed: bodyOf(i).confirmed, idempotency_key: bodyOf(i).idempotency_key }),
};

export const draftRoute: Route = {
  method: "POST",
  auth: "demo_key",
  run: (deps, i) =>
    handleCreateDraft(deps, {
      demo_key: demoKeyOf(i), outbreak_id: i.params.id, confirmed: bodyOf(i).confirmed, idempotency_key: bodyOf(i).idempotency_key,
    }),
};

export const draftApproveRoute: Route = {
  method: "POST",
  auth: "demo_key",
  run: (deps, i) =>
    handleApproveDraft(deps, {
      demo_key: demoKeyOf(i), draft_id: i.params.id, confirmed: bodyOf(i).confirmed, idempotency_key: bodyOf(i).idempotency_key,
    }),
};
