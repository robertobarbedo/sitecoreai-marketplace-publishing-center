import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  queryItemByPath,
  createItem,
  updateItemFieldByPath,
  type SitecoreItem,
} from "./sitecore-graphql";
import type { Language } from "@/src/constants";

// Template and Parent IDs
const PUBLISHING_CENTER_TEMPLATE_ID = "{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}";
const SETTINGS_ITEM_TEMPLATE_ID = "{D2923FEE-DA4E-49BE-830C-E27764DFA269}";
const MODULES_PARENT_ID = "{08477468-D438-43D4-9D6A-6D84A611971C}";

// Paths
const MODULES_PATH = "/sitecore/system/Modules";
const MARKETPLACE_FOLDER_PATH = `${MODULES_PATH}/Marketplace`;
const PUBLISHING_CENTER_PATH = `${MARKETPLACE_FOLDER_PATH}/PublishingCenter`;
const DISPLAY_SETTINGS_PATH = `${PUBLISHING_CENTER_PATH}/DisplaySettings`;
const GENERAL_SETTINGS_PATH = `${PUBLISHING_CENTER_PATH}/GeneralSettings`;
const ADDITIONAL_STATUS_CHECK_PATH = `${PUBLISHING_CENTER_PATH}/AdditionalStatusCheck`;
const CUSTOM_ACTIONS_PATH = `${PUBLISHING_CENTER_PATH}/CustomActions`;
const PUBLISHING_OPTIONS_PATH = `${PUBLISHING_CENTER_PATH}/PublishingOptions`;

// Legacy paths, from before settings moved under the Marketplace folder.
const LEGACY_PUBLISHING_CENTER_PATH = `${MODULES_PATH}/PublishingCenter`;
const LEGACY_DISPLAY_SETTINGS_PATH = `${LEGACY_PUBLISHING_CENTER_PATH}/DisplaySettings`;
const LEGACY_GENERAL_SETTINGS_PATH = `${LEGACY_PUBLISHING_CENTER_PATH}/GeneralSettings`;
const LEGACY_ADDITIONAL_STATUS_CHECK_PATH = `${LEGACY_PUBLISHING_CENTER_PATH}/AdditionalStatusCheck`;
const LEGACY_CUSTOM_ACTIONS_PATH = `${LEGACY_PUBLISHING_CENTER_PATH}/CustomActions`;
const LEGACY_PUBLISHING_OPTIONS_PATH = `${LEGACY_PUBLISHING_CENTER_PATH}/PublishingOptions`;

export interface GeneralSettings {
  timestampMetaName: string;
  /**
   * Vercel Deployment Protection bypass password. When set, the Website
   * status check appends ?x-vercel-protection-bypass=...&x-vercel-set-bypass-cookie=true
   * to the fetched page URL so protected deployments answer with the page
   * instead of the auth wall.
   */
  vercelProtectionBypass: string;
}

export interface DisplaySettings {
  showPublishingStatus: boolean;
  showPublishingActions: boolean;
  showPublish: boolean;
  showUnpublish: boolean;
  showDelete: boolean;
  showForcePublish: boolean;
  showPublishingActivity: boolean;
  showPageReferencesDebug: boolean;
}

export interface StatusCheckConfig {
  id: string;
  name: string;
  url: string;
}

export interface AdditionalStatusChecks {
  checks: StatusCheckConfig[];
}

export interface ActionConfig {
  id: string;
  name: string;
  url: string;
}

export interface CustomActions {
  actions: ActionConfig[];
}

export type PublishMode = "SMART" | "FULL";
export type PublishLanguageOption = "current" | "all";

export interface PublishTargets {
  currentItem: boolean;
  currentItemData: boolean;
  siteDataFolder: boolean;
  fullSite: boolean;
}

export interface PublishButtonConfig {
  mode: PublishMode;
  relatedItems: boolean;
  subItems: boolean;
  languages: PublishLanguageOption;
  targets: PublishTargets;
}

export interface PublishingOptionsSettings {
  publish: PublishButtonConfig;
  forcePublish: PublishButtonConfig;
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  timestampMetaName: "Last-Modified",
  vercelProtectionBypass: "",
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showPublishingStatus: true,
  showPublishingActions: true,
  showPublish: true,
  showUnpublish: true,
  showDelete: true,
  showForcePublish: false,
  showPublishingActivity: true,
  showPageReferencesDebug: false,
};

const DEFAULT_ADDITIONAL_STATUS_CHECKS: AdditionalStatusChecks = {
  checks: [],
};

const DEFAULT_CUSTOM_ACTIONS: CustomActions = {
  actions: [],
};

const DEFAULT_PUBLISH_TARGETS: PublishTargets = {
  currentItem: true,
  currentItemData: false,
  siteDataFolder: false,
  fullSite: false,
};

export const DEFAULT_PUBLISHING_OPTIONS: PublishingOptionsSettings = {
  publish: {
    mode: "SMART",
    relatedItems: true,
    subItems: false,
    languages: "current",
    targets: { ...DEFAULT_PUBLISH_TARGETS },
  },
  forcePublish: {
    mode: "FULL",
    relatedItems: true,
    subItems: false,
    languages: "current",
    targets: { ...DEFAULT_PUBLISH_TARGETS },
  },
};

/** Reads and JSON-parses the `Value` field of the item at `path`; null if absent/unparsable. */
async function readValueField(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language
): Promise<unknown> {
  const item = await queryItemByPath(client, sitecoreContextId, path, language);
  const valueField = item?.fields?.nodes?.find((f) => f.name === "Value");
  if (!valueField?.value) return null;

  try {
    return JSON.parse(valueField.value);
  } catch {
    return null;
  }
}

/** Ensures a folder item exists, creating it under `parentId` if missing. */
async function ensureFolder(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  parentId: string,
  name: string,
  language: Language
): Promise<SitecoreItem> {
  const existing = await queryItemByPath(client, sitecoreContextId, path, language);
  if (existing) return existing;

  const created = await createItem(
    client,
    sitecoreContextId,
    parentId,
    PUBLISHING_CENTER_TEMPLATE_ID,
    name,
    language
  );
  if (!created) {
    throw new Error(`Failed to create ${name} folder`);
  }
  return created;
}

/** Ensures /sitecore/system/Modules/Marketplace/PublishingCenter exists; returns its item. */
async function ensurePublishingCenterFolder(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<SitecoreItem> {
  const marketplaceFolder = await ensureFolder(
    client,
    sitecoreContextId,
    MARKETPLACE_FOLDER_PATH,
    MODULES_PARENT_ID,
    "Marketplace",
    language
  );
  return ensureFolder(
    client,
    sitecoreContextId,
    PUBLISHING_CENTER_PATH,
    marketplaceFolder.itemId,
    "PublishingCenter",
    language
  );
}

/** Ensures a Settings-type item exists at `path` under `parentId`, then writes `value` to it. */
async function saveValueItem(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  parentId: string,
  name: string,
  value: unknown,
  language: Language
): Promise<void> {
  let item = await queryItemByPath(client, sitecoreContextId, path, language);

  if (!item) {
    item = await createItem(
      client,
      sitecoreContextId,
      parentId,
      SETTINGS_ITEM_TEMPLATE_ID,
      name,
      language
    );

    if (!item) {
      throw new Error(`Failed to create ${name} item`);
    }
  }

  await updateItemFieldByPath(client, sitecoreContextId, path, "Value", JSON.stringify(value), language);
}

export async function loadGeneralSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<GeneralSettings> {
  try {
    // Settings moved under /sitecore/system/Modules/Marketplace; fall back to
    // the legacy location so existing installs keep their settings. The next
    // save writes to the new path.
    const parsed =
      (await readValueField(client, sitecoreContextId, GENERAL_SETTINGS_PATH, language)) ??
      (await readValueField(client, sitecoreContextId, LEGACY_GENERAL_SETTINGS_PATH, language));

    return parsed ? { ...DEFAULT_GENERAL_SETTINGS, ...(parsed as Partial<GeneralSettings>) } : DEFAULT_GENERAL_SETTINGS;
  } catch (error) {
    console.error("Error loading general settings:", error);
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export async function loadSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<DisplaySettings> {
  try {
    const parsed =
      (await readValueField(client, sitecoreContextId, DISPLAY_SETTINGS_PATH, language)) ??
      (await readValueField(client, sitecoreContextId, LEGACY_DISPLAY_SETTINGS_PATH, language));

    return parsed ? { ...DEFAULT_DISPLAY_SETTINGS, ...(parsed as Partial<DisplaySettings>) } : DEFAULT_DISPLAY_SETTINGS;
  } catch (error) {
    console.error("Error loading settings:", error);
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export async function loadAdditionalStatusChecks(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<AdditionalStatusChecks> {
  try {
    const parsed =
      (await readValueField(client, sitecoreContextId, ADDITIONAL_STATUS_CHECK_PATH, language)) ??
      (await readValueField(client, sitecoreContextId, LEGACY_ADDITIONAL_STATUS_CHECK_PATH, language));

    return (parsed as AdditionalStatusChecks | null) ?? DEFAULT_ADDITIONAL_STATUS_CHECKS;
  } catch (error) {
    console.error("Error loading additional status checks:", error);
    return DEFAULT_ADDITIONAL_STATUS_CHECKS;
  }
}

export async function saveGeneralSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  generalSettings: GeneralSettings,
  language: Language
): Promise<void> {
  try {
    const publishingCenterItem = await ensurePublishingCenterFolder(client, sitecoreContextId, language);
    await saveValueItem(
      client,
      sitecoreContextId,
      GENERAL_SETTINGS_PATH,
      publishingCenterItem.itemId,
      "GeneralSettings",
      generalSettings,
      language
    );
  } catch (error) {
    console.error("Error saving general settings:", error);
    throw error;
  }
}

export async function saveSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  displaySettings: DisplaySettings,
  language: Language
): Promise<void> {
  try {
    const publishingCenterItem = await ensurePublishingCenterFolder(client, sitecoreContextId, language);
    await saveValueItem(
      client,
      sitecoreContextId,
      DISPLAY_SETTINGS_PATH,
      publishingCenterItem.itemId,
      "DisplaySettings",
      displaySettings,
      language
    );
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
}

export async function saveAdditionalStatusChecks(
  client: ClientSDK,
  sitecoreContextId: string,
  additionalStatusChecks: AdditionalStatusChecks,
  language: Language
): Promise<void> {
  try {
    const publishingCenterItem = await ensurePublishingCenterFolder(client, sitecoreContextId, language);
    await saveValueItem(
      client,
      sitecoreContextId,
      ADDITIONAL_STATUS_CHECK_PATH,
      publishingCenterItem.itemId,
      "AdditionalStatusCheck",
      additionalStatusChecks,
      language
    );
  } catch (error) {
    console.error("Error saving additional status checks:", error);
    throw error;
  }
}

export async function loadCustomActions(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<CustomActions> {
  try {
    const parsed =
      (await readValueField(client, sitecoreContextId, CUSTOM_ACTIONS_PATH, language)) ??
      (await readValueField(client, sitecoreContextId, LEGACY_CUSTOM_ACTIONS_PATH, language));

    return (parsed as CustomActions | null) ?? DEFAULT_CUSTOM_ACTIONS;
  } catch (error) {
    console.error("Error loading custom actions:", error);
    return DEFAULT_CUSTOM_ACTIONS;
  }
}

export async function saveCustomActions(
  client: ClientSDK,
  sitecoreContextId: string,
  customActions: CustomActions,
  language: Language
): Promise<void> {
  try {
    const publishingCenterItem = await ensurePublishingCenterFolder(client, sitecoreContextId, language);
    await saveValueItem(
      client,
      sitecoreContextId,
      CUSTOM_ACTIONS_PATH,
      publishingCenterItem.itemId,
      "CustomActions",
      customActions,
      language
    );
  } catch (error) {
    console.error("Error saving custom actions:", error);
    throw error;
  }
}

function mergePublishButtonConfig(
  defaults: PublishButtonConfig,
  parsed: Partial<PublishButtonConfig>,
): PublishButtonConfig {
  return {
    ...defaults,
    ...parsed,
    targets: { ...defaults.targets, ...(parsed.targets ?? {}) },
  };
}

export async function loadPublishingOptions(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<PublishingOptionsSettings> {
  try {
    const parsed =
      (await readValueField(client, sitecoreContextId, PUBLISHING_OPTIONS_PATH, language)) ??
      (await readValueField(client, sitecoreContextId, LEGACY_PUBLISHING_OPTIONS_PATH, language));

    if (!parsed) return DEFAULT_PUBLISHING_OPTIONS;

    const typed = parsed as { publish?: Partial<PublishButtonConfig>; forcePublish?: Partial<PublishButtonConfig> };
    return {
      publish: mergePublishButtonConfig(DEFAULT_PUBLISHING_OPTIONS.publish, typed.publish ?? {}),
      forcePublish: mergePublishButtonConfig(DEFAULT_PUBLISHING_OPTIONS.forcePublish, typed.forcePublish ?? {}),
    };
  } catch (error) {
    console.error("Error loading publishing options:", error);
    return DEFAULT_PUBLISHING_OPTIONS;
  }
}

export async function savePublishingOptions(
  client: ClientSDK,
  sitecoreContextId: string,
  publishingOptions: PublishingOptionsSettings,
  language: Language
): Promise<void> {
  try {
    const publishingCenterItem = await ensurePublishingCenterFolder(client, sitecoreContextId, language);
    await saveValueItem(
      client,
      sitecoreContextId,
      PUBLISHING_OPTIONS_PATH,
      publishingCenterItem.itemId,
      "PublishingOptions",
      publishingOptions,
      language
    );
  } catch (error) {
    console.error("Error saving publishing options:", error);
    throw error;
  }
}
