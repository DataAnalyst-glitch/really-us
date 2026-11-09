// Which storage backend a request uses. Pure apart from reading the runtime through a probe.
//
// Evidence (read from the installed code, not guessed):
// - @netlify/blobs reads its context with `globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT")`,
//   and @netlify/runtime-utils getEnvironment() returns `Netlify.env` first, then `Deno.env`, then process.env.
// - The Netlify Functions v2 bootstrap defines `globalThis.Netlify = { context, env }` and writes
//   NETLIFY_BLOBS_CONTEXT into the environment on each invocation that carries a Blobs payload.
// So "running on Netlify" must be decided from `globalThis.Netlify` too, not from process.env alone.
//
// Rule: on Netlify the backend is always Blobs. If Blobs is not configured the request fails visibly.
// There is no silent fallback to memory in production.

export type Backend = "blobs" | "memory";

export interface RuntimeProbe {
  env(key: string): string | undefined;
  netlifyGlobal: boolean; // globalThis.Netlify exists (Functions v2 runtime)
  blobsGlobalContext: boolean; // globalThis.netlifyBlobsContext is set
}

type Env = Record<string, string | undefined>;
interface NetlifyGlobals {
  Netlify?: { env?: { get?: (key: string) => string | undefined } } | null;
  netlifyBlobsContext?: unknown;
}

export function probeRuntime(env: Env, g: NetlifyGlobals = globalThis as NetlifyGlobals): RuntimeProbe {
  return {
    env(key) {
      const fromProcess = env[key];
      if (fromProcess !== undefined && fromProcess !== "") return fromProcess;
      try {
        return g.Netlify?.env?.get?.(key) || undefined;
      } catch {
        return undefined;
      }
    },
    netlifyGlobal: typeof g.Netlify === "object" && g.Netlify !== null,
    blobsGlobalContext: Boolean(g.netlifyBlobsContext),
  };
}

export function isNetlifyRuntime(p: RuntimeProbe): boolean {
  return p.netlifyGlobal || p.blobsGlobalContext || Boolean(p.env("NETLIFY_BLOBS_CONTEXT")) || Boolean(p.env("LAMBDA_TASK_ROOT"));
}

export function chooseBackend(p: RuntimeProbe): Backend {
  const wanted = p.env("STORAGE_BACKEND");
  const onNetlify = isNetlifyRuntime(p);
  if (wanted === "blobs") return "blobs";
  if (wanted === "memory") {
    if (onNetlify) throw new Error("STORAGE_BACKEND=memory is not allowed on Netlify: memory does not persist between invocations");
    return "memory";
  }
  return onNetlify ? "blobs" : "memory";
}
