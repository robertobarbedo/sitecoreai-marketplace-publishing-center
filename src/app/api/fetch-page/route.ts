import { NextRequest, NextResponse } from "next/server";

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
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SitecoreChecker/1.0)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const status = response.status;
    let updated: string | null = null;

    if (status >= 200 && status < 300) {
      const html = await response.text();
      updated = extractMetaValue(html, "Last-Modified");
    }

    return NextResponse.json({ status, updated });
  } catch (err) {
    return NextResponse.json({
      status: 0,
      updated: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
