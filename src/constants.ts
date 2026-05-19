/**
 * Generic Sitecore XM Cloud Configuration
 * 
 * These constants should be configured per site using environment variables.
 * Set the appropriate values in your .env.local file.
 */

/**
 * Editor Settings
 * Configure paths to your site's editor resources
 */
export const SETTINGS = {
  HEADER: process.env.NEXT_PUBLIC_HEADER_PATH ?? "/sitecore/content/{SITE}/Settings/Resources/Editor/Header",
  HEADER_TERTIARY_LINKS: process.env.NEXT_PUBLIC_HEADER_TERTIARY_PATH ?? "/sitecore/content/{SITE}/Settings/Resources/Editor/HeaderTertiaryLinks",
} as const;

/**
 * Sitecore template IDs
 * Update these to match your site's template IDs
 */
export const SITECORE_TEMPLATES = {
  HEADER_TERTIARY_LINK: "{1DA6BF90-0437-449B-8C53-B854A3D934FE}",
} as const;

/**
 * Sitecore content paths
 * Configure these to point to your site's content tree structure
 */
export const SITECORE_PATHS = {
  CONTENT_TREE_ROOT: process.env.NEXT_PUBLIC_CONTENT_ROOT ?? "/sitecore/content/{SITE}/Home",
  SITE_PUBLISH_ROOT: process.env.NEXT_PUBLIC_PUBLISH_ROOT ?? "/sitecore/content/{SITE}",
} as const;

/**
 * Sitecore database names
 */
export const SITECORE_DATABASES = {
  MASTER: "master",
  EXPERIENCE_EDGE: "experienceedge",
} as const;

/**
 * Supported languages
 * Configure via environment variables to match your site's language setup
 */
export const LANGUAGES = {
  PRIMARY: (process.env.NEXT_PUBLIC_PRIMARY_LANGUAGE ?? "en") as string,
  SECONDARY: (process.env.NEXT_PUBLIC_SECONDARY_LANGUAGE ?? "fr") as string,
} as const;

/**
 * Array of all supported languages
 */
export const ALL_LANGUAGES = [LANGUAGES.PRIMARY, LANGUAGES.SECONDARY] as const;

/**
 * Default language
 */
export const DEFAULT_LANGUAGE = LANGUAGES.PRIMARY;

/**
 * Language type definition
 */
export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];
