import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";
import { fetchPublicUrl, readCapped } from "../../../utils/publicFetch";
import { describeRequestError } from "../../../utils/ssrfGuard";
import { EncryptionUnavailableError, SecretSealError, isSealed, openSecret } from "../../../lib/secret-crypto";

/**
 * Vercel Deployment Protection bypass secret for the fetched site, in the
 * sealed form stored in the settings item (see src/lib/secret-crypto.ts).
 * Sent by the client as a header (never in the URL, where it would land in
 * request logs), opened here, and forwarded as Vercel's own header, to the
 * original origin only.
 */
const BYPASS_REQUEST_HEADER = "x-target-protection-bypass";

function extractMetaValue(html: string, metaName: string): string | null {
  const metaPattern = /<meta\s+([^>]*)>/gi;
  let match;
  const nameEscaped = metaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`name\\s*=\\s*["']${nameEscaped}["']`, "i");
  while ((match = metaPattern.exec(html)) !== null) {
    const attrs = match[1];
    if (nameRe.test(attrs)) {
      const contentMatch = attrs.match(/content\s*=\s*["']([^"']+)["']/i);
      if (contentMatch) return contentMatch[1];
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSitecoreUser(request);
  if (!auth.ok) return auth.response;

  const url = request.nextUrl.searchParams.get("url");
  const metaName = request.nextUrl.searchParams.get("metaName") || "Last-Modified";
  const sealedBypass = request.headers.get(BYPASS_REQUEST_HEADER)?.trim();

  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 },
    );
  }

  // A plaintext value only arrives from settings saved by an earlier version,
  // in the moment before the client re-saves them sealed; it is the user's
  // own password for their site, so it is forwarded as is.
  let bypass: string | undefined;
  if (sealedBypass) {
    try {
      bypass = isSealed(sealedBypass) ? openSecret(sealedBypass) : sealedBypass;
    } catch (err) {
      if (err instanceof SecretSealError || err instanceof EncryptionUnavailableError) {
        return NextResponse.json({ status: 0, updated: null, error: err.message });
      }
      throw err;
    }
  }

  try {
    const { response, done } = await fetchPublicUrl(url, {
      userAgent: "Mozilla/5.0 (compatible; SitecoreChecker/1.0)",
      timeoutMs: 15000,
      originHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
    });

    const status = response.status;
    let updated: string | null = null;

    try {
      // Meta tags live in <head>, so the capped read is enough
      if (status >= 200 && status < 300) {
        const html = await readCapped(response);
        updated = extractMetaValue(html, metaName);
      }
    } finally {
      done();
    }

    return NextResponse.json({ status, updated });
  } catch (err) {
    return NextResponse.json({
      status: 0,
      updated: null,
      error: describeRequestError(err),
    });
  }
}
