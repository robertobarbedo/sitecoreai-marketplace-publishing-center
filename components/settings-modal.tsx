"use client";

import { useState, useEffect } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icon";
import { mdiDeleteOutline, mdiPlus } from "@mdi/js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  loadSettings,
  saveSettings,
  loadGeneralSettings,
  saveGeneralSettings,
  loadAdditionalStatusChecks,
  saveAdditionalStatusChecks,
  loadCustomActions,
  saveCustomActions,
  loadPublishingOptions,
  savePublishingOptions,
  DEFAULT_PUBLISHING_OPTIONS,
  type DisplaySettings,
  type GeneralSettings,
  type AdditionalStatusChecks,
  type StatusCheckConfig,
  type CustomActions,
  type ActionConfig,
  type PublishingOptionsSettings,
  type PublishButtonConfig,
  type PublishMode,
  type PublishLanguageOption,
  type PublishTargets,
} from "@/src/utils/sitecore-settings";
import { Separator } from "@/components/ui/separator";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: (settings: DisplaySettings, generalSettings: GeneralSettings, additionalChecks: AdditionalStatusChecks, customActions: CustomActions, publishingOptions: PublishingOptionsSettings) => void;
  client: ClientSDK;
  appContext: ApplicationContext;
  language: string;
}

export function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
  client,
  appContext,
  language,
}: SettingsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // General Settings state
  const [timestampMetaName, setTimestampMetaName] = useState("Last-Modified");
  const [vercelProtectionBypass, setVercelProtectionBypass] = useState("");

  // Display Settings state
  const [showPublishingStatus, setShowPublishingStatus] = useState(true);
  const [showPublishingActions, setShowPublishingActions] = useState(true);
  const [showPublish, setShowPublish] = useState(true);
  const [showUnpublish, setShowUnpublish] = useState(true);
  const [showDelete, setShowDelete] = useState(true);
  const [showForcePublish, setShowForcePublish] = useState(false);
  const [showPublishingActivity, setShowPublishingActivity] = useState(true);
  const [showPageReferencesDebug, setShowPageReferencesDebug] = useState(false);

  // Additional Status Checks state
  const [statusChecks, setStatusChecks] = useState<StatusCheckConfig[]>([]);

  // Custom Actions state
  const [customActions, setCustomActions] = useState<ActionConfig[]>([]);

  // Publishing Options state
  const [publishOptions, setPublishOptions] = useState<PublishButtonConfig>(
    DEFAULT_PUBLISHING_OPTIONS.publish
  );
  const [forcePublishOptions, setForcePublishOptions] = useState<PublishButtonConfig>(
    DEFAULT_PUBLISHING_OPTIONS.forcePublish
  );

  const updatePublishOption = <K extends keyof PublishButtonConfig>(
    key: K,
    value: PublishButtonConfig[K],
  ) => {
    setPublishOptions((prev) => ({ ...prev, [key]: value }));
  };

  const updateForcePublishOption = <K extends keyof PublishButtonConfig>(
    key: K,
    value: PublishButtonConfig[K],
  ) => {
    setForcePublishOptions((prev) => ({ ...prev, [key]: value }));
  };

  const updatePublishTarget = (target: keyof PublishTargets, value: boolean) => {
    setPublishOptions((prev) => ({
      ...prev,
      targets: { ...prev.targets, [target]: value },
    }));
  };

  const updateForcePublishTarget = (target: keyof PublishTargets, value: boolean) => {
    if (target === "fullSite" && value) {
      setForcePublishOptions((prev) => ({
        ...prev,
        relatedItems: false,
        subItems: false,
        targets: {
          currentItem: false,
          currentItemData: false,
          siteDataFolder: false,
          fullSite: true,
        },
      }));
    } else {
      setForcePublishOptions((prev) => ({
        ...prev,
        targets: { ...prev.targets, [target]: value, fullSite: false },
      }));
    }
  };

  const addStatusCheck = () => {
    const newCheck: StatusCheckConfig = {
      id: `check-${Date.now()}`,
      name: "",
      url: "",
    };
    setStatusChecks([...statusChecks, newCheck]);
  };

  const updateStatusCheck = (id: string, field: "name" | "url", value: string) => {
    setStatusChecks(
      statusChecks.map((check) =>
        check.id === id ? { ...check, [field]: value } : check
      )
    );
  };

  const deleteStatusCheck = (id: string) => {
    setStatusChecks(statusChecks.filter((check) => check.id !== id));
  };

  const addAction = () => {
    const newAction: ActionConfig = {
      id: `action-${Date.now()}`,
      name: "",
      url: "",
    };
    setCustomActions([...customActions, newAction]);
  };

  const updateAction = (id: string, field: "name" | "url", value: string) => {
    setCustomActions(
      customActions.map((action) =>
        action.id === id ? { ...action, [field]: value } : action
      )
    );
  };

  const deleteAction = (id: string) => {
    setCustomActions(customActions.filter((action) => action.id !== id));
  };

  const getContextId = () => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string } }>
      | undefined;
    return resourceAccess?.[0]?.context?.preview ?? "";
  };

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadCurrentSettings = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
          const contextId = getContextId();
          if (!contextId) {
            throw new Error("No context ID available");
          }

          const generalSettings = await loadGeneralSettings(
            client,
            contextId,
            language as "en-CA" | "fr-CA"
          );

          const displaySettings = await loadSettings(
            client,
            contextId,
            language as "en-CA" | "fr-CA"
          );

          const additionalChecks = await loadAdditionalStatusChecks(
            client,
            contextId,
            language as "en-CA" | "fr-CA"
          );

          const loadedCustomActions = await loadCustomActions(
            client,
            contextId,
            language as "en-CA" | "fr-CA"
          );

          // Update general settings state
          setTimestampMetaName(generalSettings.timestampMetaName || "Last-Modified");
          setVercelProtectionBypass(generalSettings.vercelProtectionBypass || "");

          // Update display settings state
          setShowPublishingStatus(displaySettings.showPublishingStatus);
          setShowPublishingActions(displaySettings.showPublishingActions);
          setShowPublish(displaySettings.showPublish);
          setShowUnpublish(displaySettings.showUnpublish);
          setShowDelete(displaySettings.showDelete);
          setShowForcePublish(displaySettings.showForcePublish);
          setShowPublishingActivity(displaySettings.showPublishingActivity);
          setShowPageReferencesDebug(displaySettings.showPageReferencesDebug);

          // Update additional status checks state
          setStatusChecks(additionalChecks.checks);
          
          // Update custom actions state
          setCustomActions(loadedCustomActions.actions);

          // Update publishing options state
          const pubOptions = await loadPublishingOptions(
            client,
            contextId,
            language as "en-CA" | "fr-CA"
          );
          setPublishOptions(pubOptions.publish);
          setForcePublishOptions(pubOptions.forcePublish);
        } catch (err) {
          console.error("Error loading settings:", err);
          setError(err instanceof Error ? err.message : "Failed to load settings");
        } finally {
          setIsLoading(false);
        }
      };

      void loadCurrentSettings();
    }
  }, [isOpen, client, appContext, language]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const contextId = getContextId();
      if (!contextId) {
        throw new Error("No context ID available");
      }

      const generalSettings: GeneralSettings = {
        timestampMetaName: timestampMetaName.trim() || "Last-Modified",
        vercelProtectionBypass: vercelProtectionBypass.trim(),
      };

      const displaySettings: DisplaySettings = {
        showPublishingStatus,
        showPublishingActions,
        showPublish,
        showUnpublish,
        showDelete,
        showForcePublish,
        showPublishingActivity,
        showPageReferencesDebug,
      };

      const additionalChecks: AdditionalStatusChecks = {
        checks: statusChecks,
      };

      const actionsToSave: CustomActions = {
        actions: customActions,
      };

      await saveGeneralSettings(
        client,
        contextId,
        generalSettings,
        language as "en-CA" | "fr-CA"
      );

      await saveSettings(
        client,
        contextId,
        displaySettings,
        language as "en-CA" | "fr-CA"
      );

      await saveAdditionalStatusChecks(
        client,
        contextId,
        additionalChecks,
        language as "en-CA" | "fr-CA"
      );

      await saveCustomActions(
        client,
        contextId,
        actionsToSave,
        language as "en-CA" | "fr-CA"
      );

      const publishingOptions: PublishingOptionsSettings = {
        publish: publishOptions,
        forcePublish: forcePublishOptions,
      };

      await savePublishingOptions(
        client,
        contextId,
        publishingOptions,
        language as "en-CA" | "fr-CA"
      );

      setSuccessMessage("Settings saved successfully!");
      
      // Notify parent component
      onSettingsSaved(displaySettings, generalSettings, additionalChecks, actionsToSave, publishingOptions);

      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Error saving settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure display settings for the publishing center.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-gray-600">Loading settings...</div>
        ) : (
          <div className="flex flex-col gap-4" style={{ minHeight: '500px' }}>
            <Tabs defaultValue="display" className="w-full">
              <TabsList variant="line" className="w-full border-b border-border-color">
                <TabsTrigger value="display" variant="line">Display</TabsTrigger>
                <TabsTrigger value="general" variant="line">General</TabsTrigger>
                <TabsTrigger value="statusChecks" variant="line">Add Checks</TabsTrigger>
                <TabsTrigger value="actions" variant="line">Add Actions</TabsTrigger>
              </TabsList>

              {/* Display Settings Tab */}
              <TabsContent value="display" className="overflow-y-auto">
                <div className="flex flex-col gap-4">
                  {/* Show Publishing Status */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showPublishingStatus"
                      checked={showPublishingStatus}
                      onCheckedChange={(checked) => setShowPublishingStatus(checked === true)}
                    />
                    <label
                      htmlFor="showPublishingStatus"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Show Publishing Status
                    </label>
                  </div>

                  {/* Show Publishing Actions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="showPublishingActions"
                        checked={showPublishingActions}
                        onCheckedChange={(checked) => setShowPublishingActions(checked === true)}
                      />
                      <label
                        htmlFor="showPublishingActions"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Show Publishing Actions
                      </label>
                    </div>

                    {/* Nested checkboxes for Publishing Actions */}
                    {showPublishingActions && (
                      <div className="ml-8 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="showPublish"
                            checked={showPublish}
                            onCheckedChange={(checked) => setShowPublish(checked === true)}
                          />
                          <label
                            htmlFor="showPublish"
                            className="text-sm leading-none cursor-pointer text-gray-700"
                          >
                            Show Publish
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="showUnpublish"
                            checked={showUnpublish}
                            onCheckedChange={(checked) => setShowUnpublish(checked === true)}
                          />
                          <label
                            htmlFor="showUnpublish"
                            className="text-sm leading-none cursor-pointer text-gray-700"
                          >
                            Show Unpublish
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="showDelete"
                            checked={showDelete}
                            onCheckedChange={(checked) => setShowDelete(checked === true)}
                          />
                          <label
                            htmlFor="showDelete"
                            className="text-sm leading-none cursor-pointer text-gray-700"
                          >
                            Show Delete
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="showForcePublish"
                            checked={showForcePublish}
                            onCheckedChange={(checked) => setShowForcePublish(checked === true)}
                          />
                          <label
                            htmlFor="showForcePublish"
                            className="text-sm leading-none cursor-pointer text-gray-700"
                          >
                            Show Force Publish
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Show Publishing Activity */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showPublishingActivity"
                      checked={showPublishingActivity}
                      onCheckedChange={(checked) => setShowPublishingActivity(checked === true)}
                    />
                    <label
                      htmlFor="showPublishingActivity"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Show Publishing Activity
                    </label>
                  </div>

                  {/* Show Page References Debug */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="showPageReferencesDebug"
                      checked={showPageReferencesDebug}
                      onCheckedChange={(checked) => setShowPageReferencesDebug(checked === true)}
                    />
                    <label
                      htmlFor="showPageReferencesDebug"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Show Page References Debug
                    </label>
                  </div>
                </div>
              </TabsContent>

              {/* General Settings Tab */}
              <TabsContent value="general" className="overflow-y-auto max-h-[400px]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="timestampMetaName"
                      className="text-sm font-medium leading-none"
                    >
                      Timestamp Meta Element Name
                    </label>
                    <p className="text-xs text-gray-600">
                      The name of the HTML meta element that contains the page's last updated timestamp.
                      Defaults to "Last-Modified" if left empty.
                    </p>
                    <Input
                      id="timestampMetaName"
                      type="text"
                      placeholder="Last-Modified"
                      value={timestampMetaName}
                      onChange={(e) => setTimestampMetaName(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="vercelProtectionBypass"
                      className="text-sm font-medium leading-none"
                    >
                      Vercel's Deployment Protection Password
                    </label>
                    <p className="text-xs text-gray-600">
                      Bypass password for Vercel's Deployment Protection. When set, the Website
                      status check fetches the page with the x-vercel-protection-bypass query
                      string so protected deployments can be checked. Leave empty if the site
                      is not protected.
                    </p>
                    <Input
                      id="vercelProtectionBypass"
                      type="password"
                      placeholder=""
                      value={vercelProtectionBypass}
                      onChange={(e) => setVercelProtectionBypass(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <Separator />

                  {/* Publish Section */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Publish</h3>
                    <p className="text-xs text-gray-600">
                      Configure the default options used by the Publish button.
                    </p>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Mode</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updatePublishOption("mode", "SMART")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            publishOptions.mode === "SMART"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Smart
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePublishOption("mode", "FULL")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            publishOptions.mode === "FULL"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Republish
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="publishRelatedItems"
                        checked={publishOptions.relatedItems}
                        onCheckedChange={(checked) => updatePublishOption("relatedItems", checked === true)}
                      />
                      <label htmlFor="publishRelatedItems" className="text-xs leading-none cursor-pointer text-gray-700">
                        Related Items
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="publishSubItems"
                        checked={publishOptions.subItems}
                        onCheckedChange={(checked) => updatePublishOption("subItems", checked === true)}
                      />
                      <label htmlFor="publishSubItems" className="text-xs leading-none cursor-pointer text-gray-700">
                        Sub-items
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Languages</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updatePublishOption("languages", "current")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            publishOptions.languages === "current"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Current Language
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePublishOption("languages", "all")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            publishOptions.languages === "all"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          All Languages
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Targets</label>
                      <div className="flex flex-col gap-2 ml-1">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="publishTargetCurrentItem"
                            checked={publishOptions.targets.currentItem}
                            disabled
                          />
                          <label htmlFor="publishTargetCurrentItem" className="text-xs leading-none text-gray-500">
                            Current Item
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="publishTargetCurrentItemData"
                            checked={publishOptions.targets.currentItemData}
                            onCheckedChange={(checked) => updatePublishTarget("currentItemData", checked === true)}
                          />
                          <label htmlFor="publishTargetCurrentItemData" className="text-xs leading-none cursor-pointer text-gray-700">
                            Current Item Data Folder (includes subitems)
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="publishTargetSiteDataFolder"
                            checked={publishOptions.targets.siteDataFolder}
                            onCheckedChange={(checked) => updatePublishTarget("siteDataFolder", checked === true)}
                          />
                          <label htmlFor="publishTargetSiteDataFolder" className="text-xs leading-none cursor-pointer text-gray-700">
                            Site Data Folder (includes subitems)
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Force Publish Section */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Force Publish</h3>
                    <p className="text-xs text-gray-600">
                      Configure the default options used by the Force Publish button.
                    </p>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Mode</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateForcePublishOption("mode", "SMART")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            forcePublishOptions.mode === "SMART"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Smart
                        </button>
                        <button
                          type="button"
                          onClick={() => updateForcePublishOption("mode", "FULL")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            forcePublishOptions.mode === "FULL"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Republish
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="forcePublishRelatedItems"
                        checked={forcePublishOptions.relatedItems}
                        disabled={forcePublishOptions.targets.fullSite}
                        onCheckedChange={(checked) => updateForcePublishOption("relatedItems", checked === true)}
                      />
                      <label
                        htmlFor="forcePublishRelatedItems"
                        className={`text-xs leading-none ${forcePublishOptions.targets.fullSite ? "text-gray-400" : "cursor-pointer text-gray-700"}`}
                      >
                        Related Items
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="forcePublishSubItems"
                        checked={forcePublishOptions.subItems}
                        disabled={forcePublishOptions.targets.fullSite}
                        onCheckedChange={(checked) => updateForcePublishOption("subItems", checked === true)}
                      />
                      <label
                        htmlFor="forcePublishSubItems"
                        className={`text-xs leading-none ${forcePublishOptions.targets.fullSite ? "text-gray-400" : "cursor-pointer text-gray-700"}`}
                      >
                        Sub-items
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Languages</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateForcePublishOption("languages", "current")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            forcePublishOptions.languages === "current"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          Current Language
                        </button>
                        <button
                          type="button"
                          onClick={() => updateForcePublishOption("languages", "all")}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            forcePublishOptions.languages === "all"
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          All Languages
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-medium text-gray-700">Targets</label>
                      <div className="flex flex-col gap-2 ml-1">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="forcePublishTargetCurrentItem"
                            checked={forcePublishOptions.targets.currentItem}
                            disabled={forcePublishOptions.targets.fullSite}
                            onCheckedChange={(checked) => updateForcePublishTarget("currentItem", checked === true)}
                          />
                          <label
                            htmlFor="forcePublishTargetCurrentItem"
                            className={`text-xs leading-none ${forcePublishOptions.targets.fullSite ? "text-gray-400" : "cursor-pointer text-gray-700"}`}
                          >
                            Current Item
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="forcePublishTargetCurrentItemData"
                            checked={forcePublishOptions.targets.currentItemData}
                            disabled={forcePublishOptions.targets.fullSite}
                            onCheckedChange={(checked) => updateForcePublishTarget("currentItemData", checked === true)}
                          />
                          <label
                            htmlFor="forcePublishTargetCurrentItemData"
                            className={`text-xs leading-none ${forcePublishOptions.targets.fullSite ? "text-gray-400" : "cursor-pointer text-gray-700"}`}
                          >
                            Current Item Data Folder (includes subitems)
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="forcePublishTargetSiteDataFolder"
                            checked={forcePublishOptions.targets.siteDataFolder}
                            disabled={forcePublishOptions.targets.fullSite}
                            onCheckedChange={(checked) => updateForcePublishTarget("siteDataFolder", checked === true)}
                          />
                          <label
                            htmlFor="forcePublishTargetSiteDataFolder"
                            className={`text-xs leading-none ${forcePublishOptions.targets.fullSite ? "text-gray-400" : "cursor-pointer text-gray-700"}`}
                          >
                            Site Data Folder (includes subitems)
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="forcePublishTargetFullSite"
                            checked={forcePublishOptions.targets.fullSite}
                            onCheckedChange={(checked) => updateForcePublishTarget("fullSite", checked === true)}
                          />
                          <label htmlFor="forcePublishTargetFullSite" className="text-xs leading-none cursor-pointer text-gray-700">
                            Full Site
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Add Status Checks Tab */}
              <TabsContent value="statusChecks" className="overflow-y-auto max-h-[400px]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium">Custom Status Checks</h3>
                      <p className="text-[10px] text-gray-600">
                        Add custom URL checks to monitor additional resources.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addStatusCheck}
                      className="h-7 text-xs"
                    >
                      <Icon path={mdiPlus} size={0.5} className="mr-1" />
                      Add
                    </Button>
                  </div>

                  <div className="text-[10px] text-gray-700 bg-gray-50 p-2 rounded-md">
                    <span className="font-medium">Tokens: </span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">PATH</code>
                    <span className="mx-1">•</span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">ID</code>
                    <span className="mx-1">•</span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">LANGUAGE</code>
                  </div>

                  {statusChecks.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">
                      No custom status checks configured. Click Add to create one.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {statusChecks.map((check) => (
                        <div
                          key={check.id}
                          className="flex flex-col gap-1.5 p-2 border border-gray-200 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-gray-700">
                              Name
                            </label>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => deleteStatusCheck(check.id)}
                              title="Delete"
                              className="h-5 w-5"
                            >
                              <Icon path={mdiDeleteOutline} size={0.5} />
                            </Button>
                          </div>
                          <Input
                            type="text"
                            placeholder="e.g., CDN Cache"
                            value={check.name}
                            onChange={(e) =>
                              updateStatusCheck(check.id, "name", e.target.value)
                            }
                            className="text-xs h-7"
                          />
                          <label className="text-[10px] font-medium text-gray-700">
                            URL
                          </label>
                          <Input
                            type="text"
                            placeholder="https://example.com/status?path=PATH&id=ID"
                            value={check.url}
                            onChange={(e) =>
                              updateStatusCheck(check.id, "url", e.target.value)
                            }
                            className="text-xs h-7"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Add Actions Tab */}
              <TabsContent value="actions" className="overflow-y-auto max-h-[400px]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium">Custom Actions</h3>
                      <p className="text-[10px] text-gray-600">
                        Add custom action buttons to trigger API calls.<br />For example, you can add a cache clearer for ISR in Vercel.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addAction}
                      className="h-7 text-xs"
                    >
                      <Icon path={mdiPlus} size={0.5} className="mr-1" />
                      Add
                    </Button>
                  </div>

                  <div className="text-[10px] text-gray-700 bg-gray-50 p-2 rounded-md">
                    <span className="font-medium">Tokens: </span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">PATH</code>
                    <span className="mx-1">•</span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">ID</code>
                    <span className="mx-1">•</span>
                    <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-semibold text-gray-800">LANGUAGE</code>
                  </div>

                  {customActions.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">
                      No custom actions configured. Click Add to create one.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {customActions.map((action) => (
                        <div
                          key={action.id}
                          className="flex flex-col gap-1.5 p-2 border border-gray-200 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-gray-700">
                              Name
                            </label>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => deleteAction(action.id)}
                              title="Delete"
                              className="h-5 w-5"
                            >
                              <Icon path={mdiDeleteOutline} size={0.5} />
                            </Button>
                          </div>
                          <Input
                            type="text"
                            placeholder="e.g., Refresh Vercel Cache"
                            value={action.name}
                            onChange={(e) =>
                              updateAction(action.id, "name", e.target.value)
                            }
                            className="text-xs h-7"
                          />
                          <label className="text-[10px] font-medium text-gray-700">
                            URL
                          </label>
                          <Input
                            type="text"
                            placeholder="https://example.com/api/revalidate?path=PATH&id=ID"
                            value={action.url}
                            onChange={(e) =>
                              updateAction(action.id, "url", e.target.value)
                            }
                            className="text-xs h-7"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

            </Tabs>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">{successMessage}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4 border-t">
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={isSaving || isLoading}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
          <div className="text-left">
            <span className="text-xs text-gray-400">Developed by Roberto Barbedo</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
