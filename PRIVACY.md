# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data Publishing Center handles, where it goes,
what is stored and for how long, and how to exercise your rights.

## Summary

- The app has no database. Its server stores no Sitecore content, item data
  or credentials.
- The app's settings, including the optional Vercel protection bypass
  password (encrypted), are stored in your own SitecoreAI environment.
- The app has no analytics, tracking or advertising.
- Data leaves your browser only in the ways listed under
  [Where data goes](#where-data-goes).

## How the application works

The app runs inside the SitecoreAI Pages editor as a context panel. It reads
the current page, and publishes, unpublishes or deletes it, through the
Sitecore Marketplace SDK, which calls your environment with your own
SitecoreAI permissions:

- Sitecore Authoring and Management GraphQL API (item fields, publishing,
  delete to the recycle bin, publishing jobs, sites, settings items)
- Experience Edge GraphQL API (Live, and Preview for the optional page
  references panel)

These calls go from your browser to Sitecore and do not pass through the
app's server.

## Where data goes

1. **Sitecore.** The Authoring and Experience Edge calls above, and sign-in
   requests to Sitecore Cloud (see [Sign-in](#sign-in)).
2. **The app's own server.** For requests the browser can't make to other
   origins, the browser sends the app's server, together with your Sitecore
   Cloud access token (which proves you are signed in):
   - the page's live URL, for the Website check (`/api/fetch-page`), and, if
     the website is protected by Vercel Deployment Protection, the
     **encrypted** bypass password in a request header;
   - the URLs of the custom status checks and custom actions configured by
     your admins, with the page path, ID and language filled in
     (`/api/fetch-custom-status`, `/api/proxy-action`);
   - when an admin saves the Vercel protection bypass password, the
     password and its hostnames (`/api/secrets/seal`), which the server
     encrypts and returns; it is not stored on the server.

   URLs are sent in the request's query string, so they can appear in the
   hosting provider's request logs. The server requests those URLs, so the
   target website sees the request coming from the app's server. It returns
   only the HTTP status and the timestamp value (Website check) or the
   response (custom checks and actions) to your browser, and stores none of
   it.
3. **Your website and your custom endpoints**, which receive the requests
   described above. The decrypted bypass password is sent only to a page on
   one of the hostnames it was saved for.

The app does not share data with anyone else.

## Sign-in

The app's server routes require you to sign in with your Sitecore Cloud
account (Sitecore's Auth0 tenant at `auth.sitecorecloud.io`). The sign-in is
handled by Sitecore. The app only receives the resulting access and refresh
tokens; the browser sends the refresh token back to Sitecore's sign-in
service to renew your session.

## What is stored, and where

- **In your SitecoreAI environment:** the app's settings, as items under
  `/sitecore/system/Modules/Marketplace/PublishingCenter` (older versions:
  `/sitecore/system/Modules/PublishingCenter`): display options, the
  timestamp meta element name, publishing defaults, custom check and action
  names and URLs, and the Vercel protection bypass password, encrypted with
  AES-256-GCM using a key that only the app's server holds, together with
  its hostnames. These items are governed by your Sitecore agreement and stay
  in your environment's region.
- **In your browser's local storage:** sign-in tokens (access and refresh
  tokens) and the current organization ID, so you stay signed in and
  switching organization forces a new sign-in. This data stays on your
  device.
- **In the app's server logs:** one JSON audit line per sign-in decision and
  sensitive operation (page fetch, custom check, custom action, password
  encryption), with a UTC timestamp, your Sitecore Cloud user ID and
  organization ID, the target hostname (no URL path or query) and the
  outcome. Logs never contain tokens, the bypass password or page content.

## Retention

- Server logs are kept for 90 days, then deleted.
- Settings items are kept until an admin changes or deletes them.
- Local storage is kept until you sign out, the tokens expire, or you clear
  the site data in your browser.

## Who can access the data

- Settings items: users of your SitecoreAI environment with read access to
  the module folder; changing them needs write access.
- Server logs: the app's publisher, for operating and securing the service.
- Local storage: only your browser.

## How data is protected

- All traffic uses TLS 1.2 or later, and the app sets HSTS.
- The app's server routes accept only valid Sitecore Cloud access tokens
  issued to this app.
- Server-side requests only reach public hosts over `http`/`https` on ports
  80 and 443, without credentials in the URL; each redirect is re-checked,
  and the bypass password is never forwarded to another origin.
- The bypass password is encrypted with AES-256-GCM before it is stored;
  the browser and the settings item only ever hold ciphertext.
- Data at rest is encrypted by the hosting and log providers.

## Sub-processors

- **Vercel** (hosting of the app and its server routes). Serverless
  functions run in the United States (Vercel's default region `iad1`,
  Washington, D.C.) unless the deployment sets another region.
- **Sitecore** (sign-in and the SitecoreAI APIs), under your own Sitecore
  agreement.

No other third parties receive data from the app.

## Your rights

Depending on where you live, you may have the right to access, correct,
delete or export your personal data, or to object to its processing. The
publisher keeps no personal data beyond the server logs described above. To
make a request, email rb205@proton.me; we answer within 30 days.

## Deleting your data

- **Settings and the stored password:** delete the items under
  `/sitecore/system/Modules/Marketplace/PublishingCenter` (and the older
  `/sitecore/system/Modules/PublishingCenter`, if present), or remove the
  password in the app's Settings.
- **Browser data:** sign out, or clear the site data for the app in your
  browser.
- **Server logs:** deleted automatically after 90 days, or earlier on
  request to rb205@proton.me.

## Changes to this policy

We may update this policy from time to time. Changes are reflected in the
"Last updated" date at the top of this document.

## Contact

Questions about this policy: email rb205@proton.me or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-publishing-center/issues.
