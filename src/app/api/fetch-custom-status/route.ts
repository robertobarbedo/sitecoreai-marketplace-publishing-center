import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";
import { auditLog } from "../../../lib/marketplace-auth/audit-log";
import { fetchPublicUrl, hostOf, readCapped } from "../../../utils/publicFetch";
import { describeRequestError } from "../../../utils/ssrfGuard";

export async function GET(request: NextRequest) {
  const auth = await requireSitecoreUser(request);
  if (!auth.ok) return auth.response;

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 },
    );
  }

  // Target host only: the path and query may carry page data
  const audit = {
    sub: auth.user.sub,
    org: auth.user.organizationId,
    targetHost: hostOf(url),
  };

  try {
    const { response, done } = await fetchPublicUrl(url, {
      userAgent: "Mozilla/5.0 (compatible; SitecoreChecker/1.0)",
      timeoutMs: 15000,
    });

    const status = response.status;
    let content: any = null;

    try {
      if (status >= 200 && status < 300) {
        const text = await readCapped(response);
        try {
          content = JSON.parse(text);
        } catch {
          content = text;
        }
      }
    } finally {
      done();
    }

    auditLog(request, {
      event: "custom_status.fetch",
      outcome: "allow",
      upstreamStatus: status,
      ...audit,
    });

    return NextResponse.json({ status, content });
  } catch (err) {
    const error = describeRequestError(err);
    auditLog(request, {
      event: "custom_status.fetch",
      outcome: "error",
      reason: error,
      ...audit,
    });
    return NextResponse.json({
      status: 0,
      content: null,
      error,
    });
  }
}
