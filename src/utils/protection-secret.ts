import { authedFetch } from "@/src/lib/marketplace-auth/authedFetch";

/** Same marker as SEAL_VERSION in src/lib/secret-crypto.ts (server-only). */
export function isSealedSecret(value: string): boolean {
  return value.startsWith("v1.");
}

/** Returns the server-encrypted form of the protection password. */
export async function sealProtectionBypass(plaintext: string): Promise<string> {
  if (!plaintext || isSealedSecret(plaintext)) return plaintext;

  const response = await authedFetch("/api/secrets/seal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: plaintext }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body?.sealed !== "string") {
    throw new Error(body?.detail || body?.error || `Could not encrypt the protection password (${response.status})`);
  }
  return body.sealed;
}
