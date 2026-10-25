import { NextRequest, NextResponse } from "next/server";
import { requireSitecoreUser } from "../../../lib/marketplace-auth/server";
import { fetchPublicUrl, readCapped } from "../../../utils/publicFetch";
import { describeRequestError } from "../../../utils/ssrfGuard";

export async function GET(request: NextRequest) {
  const auth = await requireSitecoreUser(request);
  if (!auth.ok) return auth.response;

  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 }
    );
  }

  try {
    const { response, done } = await fetchPublicUrl(targetUrl, {
      userAgent: "Mozilla/5.0 (compatible; SitecorePublishingCenter/1.0)",
      timeoutMs: 30000,
    });

    let data;
    try {
      const text = await readCapped(response);
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      } else {
        data = text;
      }
    } finally {
      done();
    }

    return NextResponse.json(
      {
        status: response.status,
        statusText: response.statusText,
        data,
      },
      { status: response.status }
    );
  } catch (err) {
    const errorMessage = describeRequestError(err);
    return NextResponse.json(
      {
        status: 0,
        statusText: "Request failed",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
