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
const PUBLISHING_CENTER_PATH = "/sitecore/system/Modules/PublishingCenter";
const DISPLAY_SETTINGS_PATH = "/sitecore/system/Modules/PublishingCenter/DisplaySettings";
const GENERAL_SETTINGS_PATH = "/sitecore/system/Modules/PublishingCenter/GeneralSettings";
const ADDITIONAL_STATUS_CHECK_PATH = "/sitecore/system/Modules/PublishingCenter/AdditionalStatusCheck";
const CUSTOM_ACTIONS_PATH = "/sitecore/system/Modules/PublishingCenter/CustomActions";

export interface GeneralSettings {
  timestampMetaName: string;
}

export interface DisplaySettings {
  showPublishingStatus: boolean;
  showPublishingActions: boolean;
  showPublish: boolean;
  showUnpublish: boolean;
  showDelete: boolean;
  showForcePublish: boolean;
  showPublishingActivity: boolean;
  showPublishingContext: boolean;
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

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  timestampMetaName: "Last-Modified",
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showPublishingStatus: true,
  showPublishingActions: true,
  showPublish: true,
  showUnpublish: true,
  showDelete: true,
  showForcePublish: false,
  showPublishingActivity: true,
  showPublishingContext: false,
};

const DEFAULT_ADDITIONAL_STATUS_CHECKS: AdditionalStatusChecks = {
  checks: [],
};

const DEFAULT_CUSTOM_ACTIONS: CustomActions = {
  actions: [],
};

export async function loadGeneralSettings(
  client: ClientSDK,
  sitecoreContextId: string,
  language: Language
): Promise<GeneralSettings> {
  try {
    const generalSettingsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      GENERAL_SETTINGS_PATH,
      language
    );

    let generalSettings = DEFAULT_GENERAL_SETTINGS;
    if (generalSettingsItem?.fields?.nodes) {
      const valueField = generalSettingsItem.fields.nodes.find(
        (f) => f.name === "Value"
      );
      if (valueField?.value) {
        try {
          generalSettings = JSON.parse(valueField.value);
        } catch {
          generalSettings = DEFAULT_GENERAL_SETTINGS;
        }
      }
    }

    return generalSettings;
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
    // Load Display Settings
    const displaySettingsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      DISPLAY_SETTINGS_PATH,
      language
    );

    let displaySettings = DEFAULT_DISPLAY_SETTINGS;
    if (displaySettingsItem?.fields?.nodes) {
      const valueField = displaySettingsItem.fields.nodes.find(
        (f) => f.name === "Value"
      );
      if (valueField?.value) {
        try {
          // Merge with defaults so newly added fields always have a fallback value
          displaySettings = { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(valueField.value) };
        } catch {
          // If parsing fails, use defaults
          displaySettings = DEFAULT_DISPLAY_SETTINGS;
        }
      }
    }

    return displaySettings;
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
    const additionalStatusCheckItem = await queryItemByPath(
      client,
      sitecoreContextId,
      ADDITIONAL_STATUS_CHECK_PATH,
      language
    );

    let additionalStatusChecks = DEFAULT_ADDITIONAL_STATUS_CHECKS;
    if (additionalStatusCheckItem?.fields?.nodes) {
      const valueField = additionalStatusCheckItem.fields.nodes.find(
        (f) => f.name === "Value"
      );
      if (valueField?.value) {
        try {
          additionalStatusChecks = JSON.parse(valueField.value);
        } catch {
          // If parsing fails, use defaults
          additionalStatusChecks = DEFAULT_ADDITIONAL_STATUS_CHECKS;
        }
      }
    }

    return additionalStatusChecks;
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
    // 1. Ensure PublishingCenter folder exists
    let publishingCenterItem = await queryItemByPath(
      client,
      sitecoreContextId,
      PUBLISHING_CENTER_PATH,
      language
    );

    if (!publishingCenterItem) {
      // Create PublishingCenter folder
      publishingCenterItem = await createItem(
        client,
        sitecoreContextId,
        MODULES_PARENT_ID,
        PUBLISHING_CENTER_TEMPLATE_ID,
        "PublishingCenter",
        language
      );

      if (!publishingCenterItem) {
        throw new Error("Failed to create PublishingCenter folder");
      }
    }

    const publishingCenterId = publishingCenterItem.itemId;

    // 2. Ensure GeneralSettings item exists
    let generalSettingsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      GENERAL_SETTINGS_PATH,
      language
    );

    if (!generalSettingsItem) {
      // Create GeneralSettings item
      generalSettingsItem = await createItem(
        client,
        sitecoreContextId,
        publishingCenterId,
        SETTINGS_ITEM_TEMPLATE_ID,
        "GeneralSettings",
        language
      );

      if (!generalSettingsItem) {
        throw new Error("Failed to create GeneralSettings item");
      }
    }

    // 3. Update GeneralSettings Value field with JSON
    const generalSettingsJson = JSON.stringify(generalSettings);
    await updateItemFieldByPath(
      client,
      sitecoreContextId,
      GENERAL_SETTINGS_PATH,
      "Value",
      generalSettingsJson,
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
    // 1. Ensure PublishingCenter folder exists
    let publishingCenterItem = await queryItemByPath(
      client,
      sitecoreContextId,
      PUBLISHING_CENTER_PATH,
      language
    );

    if (!publishingCenterItem) {
      // Create PublishingCenter folder
      publishingCenterItem = await createItem(
        client,
        sitecoreContextId,
        MODULES_PARENT_ID,
        PUBLISHING_CENTER_TEMPLATE_ID,
        "PublishingCenter",
        language
      );

      if (!publishingCenterItem) {
        throw new Error("Failed to create PublishingCenter folder");
      }
    }

    const publishingCenterId = publishingCenterItem.itemId;

    // 2. Ensure DisplaySettings item exists
    let displaySettingsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      DISPLAY_SETTINGS_PATH,
      language
    );

    if (!displaySettingsItem) {
      // Create DisplaySettings item
      displaySettingsItem = await createItem(
        client,
        sitecoreContextId,
        publishingCenterId,
        SETTINGS_ITEM_TEMPLATE_ID,
        "DisplaySettings",
        language
      );

      if (!displaySettingsItem) {
        throw new Error("Failed to create DisplaySettings item");
      }
    }

    // 3. Update DisplaySettings Value field with JSON
    const displaySettingsJson = JSON.stringify(displaySettings);
    await updateItemFieldByPath(
      client,
      sitecoreContextId,
      DISPLAY_SETTINGS_PATH,
      "Value",
      displaySettingsJson,
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
    // 1. Ensure PublishingCenter folder exists
    let publishingCenterItem = await queryItemByPath(
      client,
      sitecoreContextId,
      PUBLISHING_CENTER_PATH,
      language
    );

    if (!publishingCenterItem) {
      // Create PublishingCenter folder
      publishingCenterItem = await createItem(
        client,
        sitecoreContextId,
        MODULES_PARENT_ID,
        PUBLISHING_CENTER_TEMPLATE_ID,
        "PublishingCenter",
        language
      );

      if (!publishingCenterItem) {
        throw new Error("Failed to create PublishingCenter folder");
      }
    }

    const publishingCenterId = publishingCenterItem.itemId;

    // 2. Ensure AdditionalStatusCheck item exists
    let additionalStatusCheckItem = await queryItemByPath(
      client,
      sitecoreContextId,
      ADDITIONAL_STATUS_CHECK_PATH,
      language
    );

    if (!additionalStatusCheckItem) {
      // Create AdditionalStatusCheck item
      additionalStatusCheckItem = await createItem(
        client,
        sitecoreContextId,
        publishingCenterId,
        SETTINGS_ITEM_TEMPLATE_ID,
        "AdditionalStatusCheck",
        language
      );

      if (!additionalStatusCheckItem) {
        throw new Error("Failed to create AdditionalStatusCheck item");
      }
    }

    // 3. Update AdditionalStatusCheck Value field with JSON
    const additionalStatusChecksJson = JSON.stringify(additionalStatusChecks);
    await updateItemFieldByPath(
      client,
      sitecoreContextId,
      ADDITIONAL_STATUS_CHECK_PATH,
      "Value",
      additionalStatusChecksJson,
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
    const customActionsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      CUSTOM_ACTIONS_PATH,
      language
    );

    let customActions = DEFAULT_CUSTOM_ACTIONS;
    if (customActionsItem?.fields?.nodes) {
      const valueField = customActionsItem.fields.nodes.find(
        (f) => f.name === "Value"
      );
      if (valueField?.value) {
        try {
          customActions = JSON.parse(valueField.value);
        } catch {
          customActions = DEFAULT_CUSTOM_ACTIONS;
        }
      }
    }

    return customActions;
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
    // 1. Ensure PublishingCenter folder exists
    let publishingCenterItem = await queryItemByPath(
      client,
      sitecoreContextId,
      PUBLISHING_CENTER_PATH,
      language
    );

    if (!publishingCenterItem) {
      // Create PublishingCenter folder
      publishingCenterItem = await createItem(
        client,
        sitecoreContextId,
        MODULES_PARENT_ID,
        PUBLISHING_CENTER_TEMPLATE_ID,
        "PublishingCenter",
        language
      );

      if (!publishingCenterItem) {
        throw new Error("Failed to create PublishingCenter folder");
      }
    }

    const publishingCenterId = publishingCenterItem.itemId;

    // 2. Ensure CustomActions item exists
    let customActionsItem = await queryItemByPath(
      client,
      sitecoreContextId,
      CUSTOM_ACTIONS_PATH,
      language
    );

    if (!customActionsItem) {
      // Create CustomActions item
      customActionsItem = await createItem(
        client,
        sitecoreContextId,
        publishingCenterId,
        SETTINGS_ITEM_TEMPLATE_ID,
        "CustomActions",
        language
      );

      if (!customActionsItem) {
        throw new Error("Failed to create CustomActions item");
      }
    }

    // 3. Update CustomActions Value field with JSON
    const customActionsJson = JSON.stringify(customActions);
    await updateItemFieldByPath(
      client,
      sitecoreContextId,
      CUSTOM_ACTIONS_PATH,
      "Value",
      customActionsJson,
      language
    );
  } catch (error) {
    console.error("Error saving custom actions:", error);
    throw error;
  }
}
