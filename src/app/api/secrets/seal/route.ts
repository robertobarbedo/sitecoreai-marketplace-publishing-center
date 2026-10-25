import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../../lib/marketplace-auth/server";
import { EncryptionUnavailableError, ensureSealed } from "../../../../lib/secret-crypto";

const MAX_SECRET_LENGTH = 1000;

/**
 * Encrypts the Vercel Deployment Protection password before the browser
 * stores it in the Sitecore settings item. Body: { secret: plaintext };
 * returns { sealed }. An already sealed value is returned unchanged; an
 * empty value stays empty.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSitecoreUser(req);
  if (!auth.ok) return auth.response;

  let secret: unknown;
  try {
    secret = (await req.json())?.secret;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof secret !== "string" || secret.length > MAX_SECRET_LENGTH) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 400 });
  }

  try {
    const trimmed = secret.trim();
    return NextResponse.json({ sealed: trimmed ? ensureSealed(trimmed) : "" });
  } catch (error) {
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
