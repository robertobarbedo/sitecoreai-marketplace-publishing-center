# Publishing Center

A Pages context panel for SitecoreAI that shows whether the page you are
editing is published and lets you publish, unpublish or delete it in place.

In SitecoreAI it is hard to tell, from inside the Pages editor, whether the
version you are looking at has reached Experience Edge and whether the live
website is actually serving it. Publishing Center answers that for the current
page: it compares the authored version with what Experience Edge and the
public website report, and puts the publishing actions and the publishing job
activity next to the result.

Admins can tune the panel from its settings: which sections and buttons to
show, the default options of the Publish and Force Publish buttons, extra
status checks against your own endpoints, and custom action buttons (for
example a cache revalidation call).

## Features

- **Status for the current page** — Editing, Live Database (Experience Edge)
  and Website cards, each marked Updated, Outdated or Missing by comparing
  timestamps with the authored item's `__Updated` value.
- **Website check behind Vercel Deployment Protection** — an optional bypass
  password lets the Website check read pages from protected Vercel
  deployments.
- **Publish** — publishes the current page to Experience Edge, with
  configurable mode (Smart or Republish), related items, subitems, languages
  (current or all of the site's languages) and extra targets (the page's
  `Data` folder, the site's `Data` folder).
- **Force Publish** — a second, separately configured publish button (off by
  default), which can also publish the full site.
- **Unpublish** — sets `__Hide version` on the current version and language
  and publishes it, which removes it from Experience Edge.
- **Safe delete** — refuses to delete a page that is still in Experience
  Edge; otherwise asks for confirmation and moves the item to the recycle bin.
- **Publishing activity** — lists publishing jobs with their state and item
  counts, refreshes every 10 seconds, and re-checks the status cards when a
  job finishes.
- **Custom status checks** — extra status cards that call your own URLs, with
  `PATH`, `ID` and `LANGUAGE` tokens.
- **Custom actions** — buttons that call your own URLs (for example to clear
  an ISR cache), with the same tokens.
- **Page references debug** — optional panel that lists the datasource items
  used by the page's layout, grouped by their common parent folders.
- **Display settings** — show or hide each section and button.

## How it works

- **Extension point:** Pages Context Panel. The app reads the current page
  (ID, path, version, language, route, site) from `pages.context` and
  subscribes to it, so it follows the page you navigate to.
- **Sitecore APIs**, called from the browser through the
  [Marketplace SDK](https://doc.sitecore.com/mp/en/developers/marketplace/introduction-to-sitecore-marketplace.html)
  with the signed-in user's own permissions:
  - [Authoring and Management GraphQL API](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/index-en.html)
    (`xmc.authoring.graphql`): read `__Updated` and `__Hide version`, update
    fields, `publishItem`, `deleteItem`, `jobs`, `sites`, and the settings
    items.
  - Experience Edge live GraphQL (`xmc.live.graphql`): the published item's
    `__Updated` value and URL.
  - Experience Edge preview GraphQL (`xmc.preview.graphql`): the page layout,
    for the page references debug panel only.
- **The app's own API routes**, used for requests the browser can't make to
  other origins (CORS). Each requires a Sitecore Cloud sign-in (see Security):
  - `GET /api/fetch-page` — fetches the live page and reads the timestamp
    meta element from its HTML.
  - `GET /api/fetch-custom-status` — fetches a custom status check URL.
  - `GET /api/proxy-action` — calls a custom action URL.
  - `POST /api/secrets/seal` — encrypts the Vercel protection bypass
    password, bound to its allowed hostnames, before the browser saves it.

Status rules:

```
Editing        always "Updated"; shows the authored __Updated timestamp
Live Database  Experience Edge item missing           -> Missing
               Edge __Updated == authored __Updated   -> Updated
               otherwise                              -> Outdated
Website        URL taken from the Experience Edge item
               HTTP 404, or no timestamp meta element -> Missing
               meta value == authored __Updated       -> Updated
               other meta value                       -> Outdated
               other HTTP status or fetch failure     -> Error
Custom check   HTTP 2xx with a JSON object holding a single
               "YYYY-MM-DD HH:MM:SS" value            -> Updated / Outdated
               other HTTP 2xx                         -> Found
               anything else                          -> Missing
```

For the Website check to report Updated, your front-end must render a meta
element (named `Last-Modified` unless you change it in settings) whose
`content` is the page item's `__Updated` value, exactly as Sitecore stores it
(for example `20260506T120000Z`).

## Requirements

- A SitecoreAI (XM Cloud) environment with Experience Edge publishing.
- Organization Admin (or equivalent) in the Cloud Portal to register and
  install the app.
- Users need write access to the page to publish, unpublish (which updates
  `__Hide version`) or delete it, and publish rights to start publishing jobs.
- Saving the settings requires create and write access under
  `/sitecore/system/Modules`.
- Single-page app client credentials for the app (custom authorization), used
  by the server-side page and URL checks.
- Optional: a Vercel Protection Bypass for Automation secret, if the website
  runs on a Vercel deployment with Deployment Protection.

## Install in SitecoreAI

1. In the Cloud Portal, open **App Studio** and choose **Create App**.
2. Enter an app name (for example `Publishing Center`) and select type
   **Custom**.
3. Add the **Pages Context Panel** extension point with route `/`.
4. Under API access, enable **SitecoreAI APIs**.
5. Set the deployment URL to `https://<your-deployment>/`.
6. Upload the app logo from
   [`publishing-center-icon.svg`](publishing-center-icon.svg).
7. Set up custom authorization: create client credentials of type
   **Single-page app**, and register your deployment origin
   (`https://<your-deployment>`) as callback URL (with a trailing `/`), logout
   URL, web origin and CORS origin. Put the client ID and the app ID in the
   deployment's environment variables (see below).
8. Install the app in your organization, then open a page in the **Pages**
   editor and select **Publishing Center** in the context panel.
9. Optional: choose **Settings** at the bottom of the panel to configure it.

## Deploy your own instance

```bash
npm install
npm run build
npm start
```

Deploy to Vercel or any Node.js host, then point the App Studio deployment URL
at it.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Yes | Client ID of the app's Single-page app client credentials. Without it every API route returns 500 and the Website, custom check and custom action calls fail. |
| `NEXT_PUBLIC_SITECORE_APP_ID` | Yes | Marketplace app ID, sent at sign-in as `product_codes=mkp_<id>`. |
| `PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY` | To use a Vercel protection password | Server-only. Passphrase of at least 16 characters (for example `openssl rand -base64 32`) used to encrypt the Vercel protection bypass password. Without it the password can't be saved. Keep it stable: changing it means the password must be entered again. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 measurement ID. Leave empty to disable analytics. |
| `NEXT_PUBLIC_SITE_LIVE_URL` | No | Fallback origin (for example `https://www.example.com`) prepended to relative custom action URLs when the page's live URL can't be read from Experience Edge. |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | No | Defaults to `auth.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | No | Defaults to `https://api-webapp.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_SCOPE` | No | Defaults to `openid profile email offline_access`. |
| `AUTH0_ISSUER` | No | Server-only. Defaults to `https://auth.sitecorecloud.io/`. |

See [`.env.example`](.env.example) for a template. Site paths, languages and the website URL are not
configured through environment variables: the app takes them from the page
context, the site definitions and Experience Edge.

The app only runs inside SitecoreAI: the Marketplace SDK needs the SitecoreAI
host iframe. Opening the deployment directly in a browser fails to connect to
Sitecore and never gets past initialization. For local development, run
`npm run dev` (port 5000), expose it over HTTPS (for example with ngrok), and
register that URL in a separate development app in App Studio.

## Configuration

Choose **Settings** at the bottom of the panel. Settings are shared by all
users of the environment and stored as JSON in the `Value` field of items
under `/sitecore/system/Modules/Marketplace/PublishingCenter`, which the app
creates on first save:

| Item | Settings tab | Contents |
| --- | --- | --- |
| `DisplaySettings` | Display | Which sections and buttons are shown. |
| `GeneralSettings` | General | Timestamp meta element name, the Vercel protection bypass password and its hostnames. |
| `PublishingOptions` | General | Defaults for the Publish and Force Publish buttons. |
| `AdditionalStatusCheck` | Add Checks | Custom status checks (name, URL). |
| `CustomActions` | Add Actions | Custom actions (name, URL). |

Items are read and written in the language of the page that is open. If an
item is not found at the path above, the app reads the older location
`/sitecore/system/Modules/PublishingCenter`; the next save writes to the new
location.

Defaults:

- Display: Publishing Status, Publishing Actions (Publish, Unpublish, Delete)
  and Publishing Activity shown; Force Publish and Page References Debug
  hidden.
- Timestamp meta element name: `Last-Modified`.
- Vercel protection bypass password: empty.
- Publish: Smart mode, related items on, subitems off, current language,
  current item only.
- Force Publish: Republish (full) mode, related items on, subitems off,
  current language, current item only.
- No custom status checks or actions.

**Vercel's Deployment Protection Password.** If the website is a Vercel
deployment with
[Deployment Protection](https://vercel.com/docs/deployment-protection)
(common for preview and staging deployments), Vercel answers the Website check
with its login wall instead of the page, so the card can't find the timestamp.
Create a Protection Bypass for Automation secret in the Vercel project and
enter it here. The app's server then sends it as the
`x-vercel-protection-bypass` header when it fetches the page. Also enter the
**Protected Hostnames** the password is for (for example
`www.example.com, example.vercel.app`): the password is encrypted together
with them and is only ever sent to a page on one of those hosts; pages on
other hosts are checked without it. Changing the hostnames requires entering
the password again. Leave both empty if the site is not protected. The field is write-only: once saved, the
password is never shown again; type a new one to replace it, or use
**Remove**.

**Custom status checks and actions.** Each entry has a name and a URL. These
tokens are replaced in the URL before the call:

- `PATH` — for status checks, the page's Sitecore item path; for actions, the
  path of the page's live URL (falling back to the item path).
- `ID` — the page item ID, lowercase, without braces.
- `LANGUAGE` — the page language.

Relative action URLs are resolved against the origin of the page's live URL
(or `NEXT_PUBLIC_SITE_LIVE_URL`). A status check that should report Updated or
Outdated must return a JSON object with a single value in
`YYYY-MM-DD HH:MM:SS` format; it is compared with the authored `__Updated`
value.

## Security and privacy

- **Sitecore access.** All reads, writes, publishes and deletes go through the
  Marketplace SDK with the signed-in SitecoreAI user's own permissions. The
  app's server never receives Sitecore credentials or tokens.
- **API routes require sign-in.** `/api/fetch-page`,
  `/api/fetch-custom-status` and `/api/proxy-action` require a Sitecore Cloud
  (Auth0) access token. The server verifies its signature, issuer, audience
  and expiry, and that it was issued to this app's client ID; other requests
  get 401 or 403. Sign-in does not block the panel: only these calls wait for
  it. Tokens are cached in the browser's localStorage (third-party cookies are
  blocked in the iframe). Details:
  [`src/lib/marketplace-auth/README.md`](src/lib/marketplace-auth/README.md).
- **Secrets.** The only secret is the optional Vercel protection bypass
  password. The app's server encrypts it (AES-256-GCM, key derived with
  HKDF-SHA256 from `PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY`) before it is
  saved, so the `GeneralSettings` item and the browser only ever hold
  ciphertext that is useless without the deployment's key. The browser sends
  the encrypted value to the app's server in a request header (never in a
  URL); the server decrypts it and forwards it only to the origin of the page
  being checked, not to redirect targets on other origins. Passwords stored
  in plain text by earlier versions are encrypted and re-saved automatically
  the next time the app loads.
- **Server-side fetch restrictions.** The three API routes only fetch `http`
  and `https` URLs on ports 80 and 443, without credentials in the URL, whose
  host resolves only to public addresses (private, loopback, link-local,
  carrier-grade NAT, multicast and reserved IPv4 and IPv6 ranges are
  rejected). The address is checked inside the connection's own DNS lookup,
  so the request goes to exactly the address that was checked, and IP-address
  hosts are refused. Redirects are followed manually, at most 5, and each hop is
  checked again. Responses are read up to 2 MB, with a 15 second timeout (30
  seconds for custom actions).
- **Data that leaves Sitecore.** The page's live URL, and the custom check
  and action URLs you configure (with the page path, ID and language filled
  in), are sent to the app's server, which requests them. The Website check
  returns only the HTTP status and the timestamp value to the browser. No
  content is sent to any other third party.
- **Analytics.** If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, Google Analytics
  receives page views and a `marketplace_client_ready` event tagged
  `app_name=publishing-center`. No content data is sent.

## Limitations

- The Website card needs a meta element whose value matches the item's
  `__Updated` value exactly; a front-end that renders a different date format
  shows Outdated, and one that renders no such element shows Missing.
- The Website check uses the URL that Experience Edge returns for the item. If
  that is not the public URL of your site, the check reads the wrong page.
- Status cards compare timestamps only. They don't detect unpublished changes
  in datasources or other related items.
- Custom status checks and actions are plain `GET` requests without custom
  headers or authentication, and only reach public hosts on ports 80 and 443.
- Token replacement is a plain text replace of `PATH`, `ID` and `LANGUAGE`, so
  those uppercase strings are replaced anywhere in the URL, including inside
  other words.
- Unpublish applies to the current version in the current language only;
  other languages stay published.
- Delete is blocked while the page is in Experience Edge; unpublish it first.

### Troubleshooting

- **"Waiting for page context…" never goes away:** the app is not running
  inside the Pages editor, or the SDK could not connect. Open it from the
  Pages context panel of an installed app.
- **Website card shows Error, and custom checks show Missing:** sign-in
  failed or is not configured. Check `NEXT_PUBLIC_AUTH0_CLIENT_ID`,
  `NEXT_PUBLIC_SITECORE_APP_ID` and the callback URL, logout URL, web origin
  and CORS origin registered for the client credentials.
- **Website card shows Missing although the page is live:** the page doesn't
  render the timestamp meta element, its name differs from the one in
  settings, or (on Vercel) Deployment Protection is answering instead of the
  page; set the bypass password.
- **Live Database shows Outdated right after publishing:** wait for the
  publishing job to finish in the Activity section; the cards refresh when it
  does.

## Development

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI
  primitives, Material Design Icons (`@mdi/js`), Marketplace SDK (`client` and
  `xmc` packages), `@auth0/auth0-react` and `jose` for sign-in.
- `npm run dev` serves on port 5000.
- Project structure:
  - `src/app/` — the panel page and the API routes (`api/`).
  - `src/utils/` — GraphQL helpers, settings storage, SSRF-safe fetch.
  - `src/lib/marketplace-auth/` — Sitecore Cloud sign-in kit
    ([README](src/lib/marketplace-auth/README.md)).
  - `components/` — panel sections, settings dialog and UI primitives.
  - `lib/` — icon and class-name helpers.

## Support

Report bugs and request features by opening an issue in this repository.
This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE).
