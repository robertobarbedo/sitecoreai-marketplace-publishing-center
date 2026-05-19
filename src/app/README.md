# Publishing Status Panel

A generic Sitecore XM Cloud publishing status panel that can be used across any website.

## Features

- Real-time publishing status monitoring (Editing, Live Database, Website)
- Publishing jobs viewer with auto-refresh
- Allow/Block publishing toggle
- Item deletion with safety checks
- **Note:** Algolia indexing has been removed in this generic version

## Configuration

See `.env.example` in the project root for required environment variables. Each site must configure:
- Content tree paths
- Language codes
- Live site URL

## Changes from CLHIA Version

- ❌ Removed: Algolia index status checking
- ❌ Removed: "Include in Algolia" toggle
- ❌ Removed: `/api/algolia-index` route
- ✅ Made generic: Site paths configurable via environment variables
- ✅ Made generic: Languages configurable

## Files

- `page.tsx`: Main route file that initializes the SDK and renders the panels
- `../../components/publishing-status.tsx`: Publishing status panel component
- `../../components/publishing-jobs.tsx`: Publishing jobs panel component

## Usage

This page is designed to be loaded within the Sitecore editor as an extension. The SDK handles communication with the parent window to receive page context information.
