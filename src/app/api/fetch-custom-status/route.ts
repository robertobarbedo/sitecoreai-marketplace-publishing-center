import { NextRequest, NextResponse } from "next/server";

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
    let content: any = null;

    if (status >= 200 && status < 300) {
      const text = await response.text();
      try {
        content = JSON.parse(text);
      } catch {
        content = text;
      }
    }

    return NextResponse.json({ status, content });
  } catch (err) {
    return NextResponse.json({
      status: 0,
      content: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
