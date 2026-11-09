import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import verify from "../../netlify/functions/verify.js";
import { describeError, forgetStorageForTests, resetStorageForTests, serve } from "../src/http.js";
import { chooseBackend, isNetlifyRuntime, probeRuntime } from "../src/storage-select.js";

// Backend selection in a Netlify-like environment. The Functions v2 runtime defines globalThis.Netlify,
// and @netlify/blobs reads its context from Netlify.env first, so process.env alone is not enough.
const probe = (env: Record<string, string | undefined>, g: Parameters<typeof probeRuntime>[1] = {}) => probeRuntime(env, g);
const netlifyGlobal = (vars: Record<string, string> = {}) => ({ Netlify: { env: { get: (k: string) => vars[k] } } });

describe("chooseBackend (pure)", () => {
  it("local run: memory", () => {
    expect(chooseBackend(probe({}))).toBe("memory");
    expect(isNetlifyRuntime(probe({}))).toBe(false);
  });

  it("STORAGE_BACKEND=blobs forces Blobs, even locally", () => {
    expect(chooseBackend(probe({ STORAGE_BACKEND: "blobs" }))).toBe("blobs");
  });

  it("Netlify Functions v2 (global Netlify, nothing in process.env): Blobs", () => {
    expect(chooseBackend(probe({}, netlifyGlobal()))).toBe("blobs");
  });

  it("the Blobs context only in Netlify.env (not in process.env): Blobs", () => {
    expect(chooseBackend(probe({}, netlifyGlobal({ NETLIFY_BLOBS_CONTEXT: "abc" })))).toBe("blobs");
  });

  it.each([
    ["NETLIFY_BLOBS_CONTEXT in process.env", { NETLIFY_BLOBS_CONTEXT: "abc" }, {}],
    ["LAMBDA_TASK_ROOT in process.env", { LAMBDA_TASK_ROOT: "/var/task" }, {}],
    ["globalThis.netlifyBlobsContext", {}, { netlifyBlobsContext: { siteID: "s" } }],
  ])("%s: Blobs", (_n, env, g) => {
    expect(chooseBackend(probe(env, g))).toBe("blobs");
  });

  it("STORAGE_BACKEND=memory is refused on Netlify, never honoured silently", () => {
    expect(() => chooseBackend(probe({ STORAGE_BACKEND: "memory" }, netlifyGlobal()))).toThrow(/not allowed on Netlify/);
    expect(() => chooseBackend(probe({ STORAGE_BACKEND: "memory", LAMBDA_TASK_ROOT: "/var/task" }))).toThrow();
  });

  it("STORAGE_BACKEND=memory works locally", () => {
    expect(chooseBackend(probe({ STORAGE_BACKEND: "memory" }))).toBe("memory");
  });

  it("a throwing Netlify.env does not break detection", () => {
    const g = { Netlify: { env: { get: () => { throw new Error("no env"); } } } };
    expect(chooseBackend(probe({}, g))).toBe("blobs");
  });
});

describe("through a function handler in a Netlify-like environment", () => {
  const call = () =>
    verify(new Request("https://example.test/v1/verify", { method: "POST", body: JSON.stringify({ company_id: "northline", message: "Hello." }) }), { params: {} });
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    forgetStorageForTests();
    vi.stubEnv("STORAGE_BACKEND", "");
    vi.stubEnv("NETLIFY_BLOBS_CONTEXT", "");
    vi.stubEnv("LAMBDA_TASK_ROOT", "");
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete (globalThis as { Netlify?: unknown }).Netlify;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetStorageForTests();
  });

  it("local: memory, request works", async () => {
    expect((await call()).status).toBe(200);
  });

  it("on Netlify without a Blobs context: a visible failure, NOT a silent fall back to memory", async () => {
    (globalThis as { Netlify?: unknown }).Netlify = { env: { get: () => undefined } };
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false, error: "SERVER_ERROR" });
    const [tag, name, message] = errors.mock.calls[0] as string[];
    expect(tag).toBe("function_error");
    expect(name).toBe("MissingBlobsEnvironmentError");
    expect(message).toMatch(/Netlify Blobs/);
  });

  it("on Netlify with STORAGE_BACKEND=memory: refused and logged", async () => {
    (globalThis as { Netlify?: unknown }).Netlify = { env: { get: () => undefined } };
    vi.stubEnv("STORAGE_BACKEND", "memory");
    const res = await call();
    expect(res.status).toBe(500);
    expect(String((errors.mock.calls[0] as string[])[2])).toMatch(/memory is not allowed on Netlify|not allowed on Netlify/);
  });

  it("on Netlify with the context only in Netlify.env: Blobs is used (the failure comes from the Blobs service, not the setup)", async () => {
    const context = Buffer.from(
      JSON.stringify({ siteID: "site", token: "tok", deployID: "dep", edgeURL: "http://127.0.0.1:9", uncachedEdgeURL: "http://127.0.0.1:9", apiURL: "http://127.0.0.1:9" }),
    ).toString("base64");
    (globalThis as { Netlify?: unknown }).Netlify = { env: { get: (k: string) => (k === "NETLIFY_BLOBS_CONTEXT" ? context : undefined) } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 401 })));
    const res = await call();
    expect(res.status).toBe(500); // memory would have answered 200
    const [, name] = errors.mock.calls[0] as string[];
    expect(name).not.toBe("MissingBlobsEnvironmentError");
    vi.unstubAllGlobals();
  });
});

describe("error logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the error name and message, and never the request body, headers or keys", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = new Request("https://example.test/x", {
      method: "POST",
      headers: { "x-api-key": "HEADER-SECRET-VALUE", authorization: "Bearer TOKEN-SECRET" },
      body: JSON.stringify({ message: "BODY-SECRET-TEXT" }),
    });
    const res = await serve(req, {}, {
      method: "POST",
      run: async () => {
        throw new TypeError("boom   happened\nhere");
      },
    });
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual(["function_error", "TypeError", "boom happened here"]);
    const logged = JSON.stringify(spy.mock.calls);
    for (const secret of ["HEADER-SECRET-VALUE", "TOKEN-SECRET", "BODY-SECRET-TEXT"]) expect(logged).not.toContain(secret);
    expect(logged).not.toMatch(/\n\s+at /);
    // and the caller still sees no message or stack
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });

  it("describeError: non-errors are 'unknown', long messages are cut", () => {
    expect(describeError("text")).toEqual(["unknown", ""]);
    expect(describeError(new Error("x".repeat(1000)))[1]).toHaveLength(300);
  });
});

describe("deploy dependency (root cause of the SERVER_ERROR in production)", () => {
  // A deploy bundles netlify/functions with the nft bundler (forced for Functions v2). It finds @netlify/blobs
  // only if it resolves from the functions tree, i.e. from a root-level install. api/node_modules is not enough.
  const read = (p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8")) as Record<string, any>;

  it("the repo root declares @netlify/blobs at the same exact version as api/", () => {
    const root = read("package.json");
    const api = read("api/package.json");
    expect(root.dependencies["@netlify/blobs"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(root.dependencies["@netlify/blobs"]).toBe(api.dependencies["@netlify/blobs"]);
  });

  it("the root lockfile pins the same version", () => {
    const lock = read("package-lock.json");
    const api = read("api/package.json");
    expect(lock.packages["node_modules/@netlify/blobs"].version).toBe(api.dependencies["@netlify/blobs"]);
  });
});
