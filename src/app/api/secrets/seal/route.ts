import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../../lib/marketplace-auth/server";
import { EncryptionUnavailableError, SecretSealError, normalizeHosts, sealSecret } from "../../../../lib/secret-crypto";

const MAX_SECRET_LENGTH = 1000;

/**
 * Encrypts the Vercel Deployment Protection password, bound to the hostnames
 * it may be sent to, before the browser stores it in the Sitecore settings
 * item. Body: { secret: plaintext, hosts: string[] }; returns
 * { sealed, hosts } with the hosts normalized.
 *
 * Only plaintext is accepted: a sealed value cannot be re-bound to other
 * hosts here, so pointing a stored password at a new host takes the password.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSitecoreUser(req);
  if (!auth.ok) return auth.response;

  let body: { secret?: unknown; hosts?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { secret, hosts } = body;
  if (typeof secret !== "string" || !secret.trim() || secret.length > MAX_SECRET_LENGTH) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 400 });
  }
  if (!Array.isArray(hosts) || !hosts.every((host) => typeof host === "string")) {
    return NextResponse.json({ error: "Invalid hosts" }, { status: 400 });
  }

  try {
    const normalizedHosts = normalizeHosts(hosts);
    return NextResponse.json({
      sealed: sealSecret({ secret: secret.trim(), hosts: normalizedHosts }),
      hosts: normalizedHosts,
    });
  } catch (error) {
    if (error instanceof SecretSealError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EncryptionUnavailableError) {
      console.error("Secret encryption unavailable:", error.message);
      return NextResponse.json(
        { error: "Password encryption is not configured on the server", detail: error.message },
        { status: 500 }
      );
    }
    console.error("Seal route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
