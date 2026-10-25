import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";
import { fetchPublicUrl, readCapped } from "../../../utils/publicFetch";
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

    return NextResponse.json({ status, content });
  } catch (err) {
    return NextResponse.json({
      status: 0,
      content: null,
      error: describeRequestError(err),
    });
  }
}
