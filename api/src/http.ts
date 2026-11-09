import { createHash, timingSafeEqual } from "node:crypto";
import { handleApproveOutbreak, handleCase, handleReport, handleSenderLookup, handleVerify, type Deps } from "./handlers.js";
import { createMemoryStorage } from "./storage.js";
import type { ApiResult } from "./types.js";

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
  auth?: "api_key" | "demo_key"; // api_key: X-API-Key must equal API_KEY. demo_key: the handler checks X-Demo-Key.
  run: (deps: Deps, info: RequestInfo) => Promise<ApiResult>;
}

// Minimal shape of the Netlify Functions (v2) context and config, so no extra dependency is needed.
export interface FunctionContext {
  params: Record<string, string>;
}

type Env = Record<string, string | undefined>;

// Memory storage does not persist between serverless invocations. See docs/DECISIONS.md.
let storage = createMemoryStorage();
export function resetStorageForTests(): void {
  storage = createMemoryStorage();
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

    let body: unknown = undefined;
    if (route.method === "POST") {
      try {
        body = JSON.parse(await req.text());
      } catch {
        return fail(400, "INVALID_JSON");
      }
    }

    const deps: Deps = { storage, env: { DEMO_DATA_ONLY: env.DEMO_DATA_ONLY, DEMO_KEY: env.DEMO_KEY } };
    const result = await route.run(deps, {
      body,
      query: new URL(req.url).searchParams,
      params,
      headers: req.headers,
    });
    return json(result.status, result.body);
  } catch (err) {
    // Log the error type only. Never return a stack trace or message to the caller.
    console.error("function_error", err instanceof Error ? err.name : "unknown");
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
