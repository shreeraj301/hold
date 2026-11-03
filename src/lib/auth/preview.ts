/**
 * Shared live-preview OAuth client (server-only. Never import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker exposes one shared
 * preview client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`.
 * When deployed, the deployer injects a per-app `GROK_AUTH_*` that overrides
 * these (see `server.ts`).
 *
 * The client id, issuer, and host list are public. The client secret is not
 * stored in this repository. Set `GROK_PREVIEW_CLIENT_SECRET` in the
 * environment. There is no committed fallback.
 */

/** Read an env var, treating empty or whitespace as unset. */
function envValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export const PREVIEW_CLIENT_ID = "grok_preview";

/**
 * Live-preview OAuth client secret from `GROK_PREVIEW_CLIENT_SECRET`.
 * Undefined when that variable is unset. Never a committed value.
 */
export const PREVIEW_CLIENT_SECRET = envValue("GROK_PREVIEW_CLIENT_SECRET");

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
