# Marketplace submission: Publishing Center

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace every `{{...}}` placeholder before submitting.

## 1. App name

Publishing Center

## 2. Headline

<!-- 374 chars -->

See whether the page you are editing in SitecoreAI Pages is really published. Publishing Center compares the authored version with Experience Edge and your live website, then lets you publish, force publish, unpublish or safely delete the page in place, follow publishing jobs as they run, and add your own status checks and action buttons such as a cache revalidation call.

## 3. Description

From inside the Pages editor it is hard to tell whether the version you are looking at has reached Experience Edge and whether the live website is actually serving it. Publishing Center is a Pages context panel that answers that for the current page and puts the publishing actions and job activity next to the result. It follows the page you navigate to.

Key features:
- Status cards for Editing, Live Database (Experience Edge) and Website, each marked Updated, Outdated or Missing by comparing timestamps with the authored __Updated value
- Website check that also works behind Vercel Deployment Protection, with an optional encrypted bypass password
- Publish with configurable mode (Smart or Republish), related items, subitems, languages and extra targets (the page's and the site's Data folders)
- Force Publish: a second, separately configured publish button (off by default)
- Unpublish: hides the current version and language and publishes it, removing it from Experience Edge
- Safe delete: refuses to delete a page that is still in Experience Edge; otherwise moves it to the recycle bin after confirmation
- Publishing activity: lists publishing jobs with state and item counts, refreshes every 10 seconds and re-checks the status when a job finishes
- Custom status checks and custom action buttons that call your own URLs with PATH, ID and LANGUAGE tokens
- Optional page references debug panel listing the datasource items used by the page
- Display settings to show or hide each section and button

Use cases:
- Confirm a page change is live before telling stakeholders
- Find out whether a stale page is a publishing problem or a website cache problem
- Trigger a front-end cache revalidation right after publishing
- Remove a page from the live site without deleting it

All Sitecore operations run with the signed-in user's own permissions.

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Publishing
- Content management

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA, with the panel open next to a page in the Pages editor.

1. Status cards with all three Updated (Editing, Live Database, Website).
2. Status cards showing Outdated or Missing for a page with unpublished changes.
3. Publishing Actions section with the Publish options and Publishing Activity listing a running job.
4. Settings dialog, Display tab.
5. Settings dialog, Add Checks or Add Actions tab with an example entry (no real internal URLs).
6. Safe delete warning for a page that is still in Experience Edge.

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-publishing-center
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-publishing-center/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-publishing-center/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-publishing-center/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md` (replace `rb205@proton.me` in it first).

Summary: page data is read and written through the Marketplace SDK with the user's own permissions, and panel settings are stored as items under `/sitecore/system/Modules/Marketplace/PublishingCenter` in the customer's own environment; there is no database. The page's live URL and any configured custom check/action URLs are sent to the app's own signed-in API routes, which request them and return only the result (for the Website check, the HTTP status and timestamp). The optional Vercel bypass password is stored only as server-encrypted ciphertext, and server audit logs (no tokens, secrets, URL paths or content) are kept for 90 days.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Pages Context Panel**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql`, `xmc.live.graphql` and `xmc.preview.graphql` through the Marketplace SDK, plus `application.context` and `pages.context`).
- Permissions: none required by the code (no `window.open`, clipboard or file downloads). Note: the publishing activity links open with `target="_blank"`; if they don't open in the portal iframe during QA, enable **Pop-ups**.
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **Yes**, required by `/api/fetch-page`, `/api/fetch-custom-status`, `/api/proxy-action` and `/api/secrets/seal`. Create Single-page app credentials and register:
  - Allowed callback URL: `{{APP_URL}}/` (with trailing slash)
  - Logout URL, web origin, CORS origin: `{{APP_URL}}`
- Environment variables on the host:
  - `NEXT_PUBLIC_AUTH0_CLIENT_ID` (required)
  - `NEXT_PUBLIC_SITECORE_APP_ID` (required)
  - `PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY` (required to save a Vercel protection password; server-only, 16+ characters, keep stable)
  - Optional: `NEXT_PUBLIC_SITE_LIVE_URL`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_AUDIENCE`, `NEXT_PUBLIC_AUTH0_SCOPE`, `AUTH0_ISSUER`, `CSP_FRAME_ANCESTORS`
- App logo: `publishing-center-icon.svg`

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Publishing Center is a Next.js 15 full-stack app on the Pages Context Panel extension point. It subscribes to `pages.context` for the current page (ID, path, version, language, route, site). From the browser, through the Marketplace SDK and with the user's own permissions, it reads `__Updated` and `__Hide version`, updates fields, runs `publishItem`, `deleteItem` and `jobs` on `xmc.authoring.graphql`, reads the published item's `__Updated` and URL from `xmc.live.graphql`, and reads the layout from `xmc.preview.graphql` for the optional references panel. Requests to other origins go through the app's own API routes (`/api/fetch-page`, `/api/fetch-custom-status`, `/api/proxy-action`) with a Sitecore Cloud token from custom authorization (Auth0 SPA client credentials); `/api/secrets/seal` encrypts the optional Vercel bypass password bound to its allowed hostnames. Settings (display, publishing defaults, custom checks/actions, meta element name, sealed password) are stored as JSON items under `/sitecore/system/Modules/Marketplace/PublishingCenter`; sign-in tokens are kept in localStorage. There is no database.

**Business value / alignment with Sitecore standards**

The app shows editors, inside the Pages editor, whether their change has actually reached Experience Edge and the live site, and gives them the publishing actions in the same place, which cuts support requests about "my change isn't live". It uses only supported Marketplace SDK APIs (`pages.context`, `xmc.authoring.graphql`, `xmc.live.graphql`, `xmc.preview.graphql`), and every Sitecore operation runs with the signed-in user's own permissions; the server never receives Sitecore credentials. The UI follows the Blok design language (Tailwind CSS v4, Radix UI). Security measures: server-side token verification on every API route (signature, issuer, audience, expiry and `azp` bound to this app's client ID); the bypass password sealed with AES-256-GCM (HKDF-SHA256 key from `PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY`), bound to its hostnames and forwarded only to the origin of the page being checked; an SSRF guard on all three fetch routes (http/https on ports 80/443, no URL credentials, IP-literal hosts refused, DNS-pinned public-address check, at most 5 manually checked redirects, 2 MB cap, 15/30 s timeouts); safe delete that blocks deleting pages still in Experience Edge; security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and `Cache-Control: no-store` on API routes; and JSON audit logging of sign-in decisions and sensitive operations without tokens, secrets, URL paths or content. No analytics.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets images.unoptimized, so sharp is never loaded. lightningcss (MPL-2.0) is a build-time-only dependency of Tailwind CSS and is not shipped.

## 12. Pre-submit checklist

- [ ] Live QA in the Pages editor: status cards follow page navigation; Updated / Outdated / Missing are correct
- [ ] Live QA: Publish, Force Publish, Unpublish and Safe delete; publishing activity refresh
- [ ] Live QA: Website check against a site whose front-end renders the `Last-Modified` meta element, and against a Vercel-protected deployment with the bypass password
- [ ] Live QA: a custom status check and a custom action
- [ ] `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_SITECORE_APP_ID` and `PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY` set on the production host; app rebuilt
- [ ] Production client credentials registered with `{{APP_URL}}` callback, logout, web origin and CORS URLs
- [ ] Screenshots captured (PNG)
- [ ] `rb205@proton.me` replaced in DATA-USAGE.md, PRIVACY.md, TERMS.md, SECURITY.md; `Roberto Barbedo`, `rb205@proton.me`, `{{APP_URL}}` replaced in this form
