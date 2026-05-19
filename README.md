# SitecoreAI Publishing Center

A generic SitecoreAI publishing status panel that provides real-time content monitoring and publishing management for any SitecoreAI website. Built with Next.js, React, and the Sitecore Marketplace SDK, this tool integrates directly into the Sitecore editor to give content authors instant visibility into publishing status across multiple layers.

## Key Capabilities

- **Multi-layer Status Tracking**: Monitor content state across Editing, Experience Edge, and live Website
- **Real-time Publishing Jobs**: View and track all publishing jobs with auto-refresh
- **Publishing Control**: Allow or block content from being published
- **Environment Agnostic**: Fully configurable via environment variables for any SitecoreAI site

## Features

### Publishing Status Panel

- **Real-time status monitoring** across three layers:
  - **Editing**: Shows the current state in the authoring environment (always "Updated")
  - **Live Database**: Checks if the page exists in the Experience Edge database and compares timestamps
  - **Website**: Verifies the page is accessible on the live website and checks its timestamp
- **Allow/Block Publishing Toggle**: Control whether a page can be published using the `__Hide version` field
- **Manual Refresh**: Force an immediate status check
- **Item Deletion**: Safe deletion with checks to ensure the item isn't still published
- **Collapsible Interface**: Expand/collapse panels to save space

### Publishing Jobs Panel

- **Live Job Monitoring**: View all publishing jobs in real-time
- **Auto-refresh**: Updates every 10 seconds when expanded
- **Job Details**: Shows job name, state, items processed, and completion status
- **Job States**: Visual badges for Queued, Running, Finished, and Failed states
- **Event Integration**: Automatically refreshes the status panel when a job completes

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Set the following environment variables for your site:

```env
# Replace {YOUR_SITE} with your actual site name
NEXT_PUBLIC_CONTENT_ROOT=/sitecore/content/MyCompany/MyCompany/Home
NEXT_PUBLIC_PUBLISH_ROOT=/sitecore/content/MyCompany/MyCompany
NEXT_PUBLIC_HEADER_PATH=/sitecore/content/MyCompany/MyCompany/Settings/Resources/Editor/Header
NEXT_PUBLIC_HEADER_TERTIARY_PATH=/sitecore/content/MyCompany/MyCompany/Settings/Resources/Editor/HeaderTertiaryLinks

# Configure your site's languages (ISO codes)
NEXT_PUBLIC_PRIMARY_LANGUAGE=en
NEXT_PUBLIC_SECONDARY_LANGUAGE=fr

# Your live/production website URL
NEXT_PUBLIC_SITE_LIVE_URL=https://your-site.com
```

### 3. Run the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5000

## Project Structure

```
sitecoreai-marketplace-publishing-center/
├── src/
│   ├── app/
│   │   ├── publishing-status/
│   │   │   └── page.tsx              # Main page component
│   │   └── api/
│   │       └── fetch-page/
│   │           └── route.ts          # API route to fetch page metadata
│   ├── utils/
│   │   ├── hooks/
│   │   │   └── useMarketplaceClient.ts  # SDK initialization hook
│   │   └── sitecore-graphql.ts       # GraphQL helper functions
│   └── constants.ts                  # Generic configuration constants
├── components/
│   ├── publishing-status.tsx         # Publishing status panel
│   ├── publishing-jobs.tsx           # Publishing jobs panel
│   └── ui/
│       ├── card.tsx                  # Card component
│       ├── button.tsx                # Button component
│       └── separator.tsx             # Separator component
├── lib/
│   ├── utils.ts                      # Tailwind class utility
│   └── icon.tsx                      # Icon component wrapper
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration Guide

### Sitecore Content Paths

The following environment variables control where the panel looks for content in your Sitecore tree:

- `NEXT_PUBLIC_CONTENT_ROOT`: Root of your content tree (e.g., `/sitecore/content/MySite/Home`)
- `NEXT_PUBLIC_PUBLISH_ROOT`: Root path for site-wide publishing (e.g., `/sitecore/content/MySite`)

### Language Configuration

Configure the languages your site supports:

- `NEXT_PUBLIC_PRIMARY_LANGUAGE`: Primary language code (default: `en`)
- `NEXT_PUBLIC_SECONDARY_LANGUAGE`: Secondary language code (default: `fr`)

The panel uses these to query items in the correct language.

### Live Site URL

- `NEXT_PUBLIC_SITE_LIVE_URL`: The URL of your live/production website. Used to check if published pages are accessible.

## Usage

### Integrating with Your Sitecore Site

This publishing center is designed to work with the Sitecore Marketplace SDK in a SitecoreAI environment. To integrate:

1. Ensure your site has the Sitecore Marketplace SDK configured
2. The panel should be loaded within an iframe in the Sitecore editor
3. The SDK will handle communication with the parent window

### API Routes

#### `/api/fetch-page`

Fetches a page from the live website and extracts the `Last-Modified` meta tag.

**Query Parameters:**
- `url` (required): The URL of the page to fetch

**Response:**
```json
{
  "status": 200,
  "updated": "20240506T120000Z"
}
```

## Development

### Building for Production

```bash
npm run build
npm start
```

### TypeScript

This project is written in TypeScript with strict type checking enabled. All components and utilities are fully typed.

## Dependencies

### Core Dependencies

- **Next.js 15**: React framework
- **React 19**: UI library
- **Tailwind CSS 4**: Styling
- **Sitecore Marketplace SDK**: Integration with SitecoreAI
- **Radix UI**: Accessible UI primitives
- **@mdi/js**: Material Design Icons

### UI Components

The project uses custom-built UI components based on Radix UI primitives and styled with Tailwind CSS.

## Troubleshooting

### "Waiting for page context..." appears indefinitely

- Ensure the app is loaded within the Sitecore editor iframe
- Check that the Marketplace SDK is properly configured
- Verify the parent window can communicate with the iframe

### Status cards show "Error"

- Check your environment variables are correctly configured
- Ensure the Sitecore GraphQL endpoints are accessible
- Verify your site's context IDs are valid

### Website status shows "Missing" but page exists

- Verify `NEXT_PUBLIC_SITE_LIVE_URL` is set correctly
- Check that the page has a `Last-Modified` meta tag in its HTML
- Ensure the live website is accessible from your server

## License

MIT License - adjust as needed for your organization.

## Support

For project-specific issues, please refer to your organization's support channels.

For Sitecore-specific questions, consult the [Sitecore Documentation](https://doc.sitecore.com/).
