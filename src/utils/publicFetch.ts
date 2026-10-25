/**
 * Server-side fetch of a user-supplied URL through the SSRF guard
 * (./ssrfGuard): public hosts only, checked at connect time, every redirect
 * hop re-checked, response bodies read with a size cap.
 */

import { safeRequest } from "./ssrfGuard";

const MAX_REDIRECTS = 5;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface PublicFetchOptions {
  userAgent: string;
  timeoutMs: number;
  /** Sent only while the request stays on the original URL's origin. */
  originHeaders?: Record<string, string>;
}

export interface PublicFetchResult {
  response: Response;
  /** Kept for callers; the body is already fully read and capped. */
  done: () => void;
}

export async function fetchPublicUrl(
  url: string,
  { userAgent, timeoutMs, originHeaders = {} }: PublicFetchOptions,
): Promise<PublicFetchResult> {
  const { response } = await safeRequest(url, {
    headers: { "User-Agent": userAgent },
    originHeaders,
    timeoutMs,
    maxBodyBytes: MAX_BODY_BYTES,
    maxRedirects: MAX_REDIRECTS,
  });
  return { response, done: () => {} };
}

/** Reads the (already capped) body as text. */
export async function readCapped(response: Response): Promise<string> {
  return response.text();
}
