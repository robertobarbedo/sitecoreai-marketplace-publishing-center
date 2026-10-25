import { authedFetch } from "@/src/lib/marketplace-auth/authedFetch";

/** Same marker as SEAL_VERSION in src/lib/secret-crypto.ts (server-only). */
export function isSealedSecret(value: string): boolean {
  return value.startsWith("v2.");
}

/** Splits the hostnames field (commas, spaces or new lines) into entries. */
export function parseHostList(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean);
}

/**
 * Returns the server-encrypted form of the protection password, bound to the
 * hostnames it may be sent to, plus those hostnames as the server normalized them.
 */
export async function sealProtectionBypass(
  plaintext: string,
  hosts: string[],
): Promise<{ sealed: string; hosts: string[] }> {
  const response = await authedFetch("/api/secrets/seal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: plaintext, hosts }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body?.sealed !== "string" || !Array.isArray(body?.hosts)) {
    throw new Error(body?.detail || body?.error || `Could not encrypt the protection password (${response.status})`);
  }
  return { sealed: body.sealed, hosts: body.hosts };
}
