"use client";

import { useState, useEffect } from "react";
import type {
  ApplicationContext,
  PagesContext,
} from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { PublishingStatus } from "@/components/publishing-status";
import { PublishingActions } from "@/components/publishing-actions";
import { PublishingJobs } from "@/components/publishing-jobs";
import { PublishingContext } from "@/components/publishing-context";
import { SettingsModal } from "@/components/settings-modal";
import { Icon } from "@/lib/icon";
import { mdiCog } from "@mdi/js";
import type { DataSource } from "@/src/types/datasource";
import { loadSettings, loadAdditionalStatusChecks, loadCustomActions, loadGeneralSettings, type DisplaySettings, type AdditionalStatusChecks, type CustomActions, type GeneralSettings } from "@/src/utils/sitecore-settings";

function PagesContextPanel() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [pagesContext, setPagesContext] = useState<PagesContext>();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    showPublishingStatus: true,
    showPublishingActions: true,
    showPublish: true,
    showUnpublish: true,
    showDelete: true,
    showPublishingActivity: true,
    showPublishingContext: false,
  });
  const [additionalChecks, setAdditionalChecks] = useState<AdditionalStatusChecks>({
    checks: [],
  });
  const [customActions, setCustomActions] = useState<CustomActions>({
    actions: [],
  });
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    timestampMetaName: "Last-Modified",
  });
  const [isLoadingCustomActions, setIsLoadingCustomActions] = useState(false);

  useEffect(() => {
    if (!error && isInitialized && client) {
      client
        .query("application.context")
        .then((res) => {
          setAppContext(res.data);
        })
        .catch((err) => {
          console.error("Error retrieving application.context:", err);
        });

      client
        .query("pages.context", {
          subscribe: true,
          onSuccess: (res) => {
            setPagesContext(res);
          },
        })
        .catch((err) => {
          console.error("Error retrieving pages.context:", err);
        });
    }
  }, [client, error, isInitialized]);

  // Load settings on mount
  useEffect(() => {
    const pageLanguage = pagesContext?.pageInfo?.language;
    
    if (client && appContext && pageLanguage) {
      const loadInitialSettings = async () => {
        try {
          const resourceAccess = appContext.resourceAccess as
            | Array<{ context?: { preview?: string } }>
            | undefined;
          const contextId = resourceAccess?.[0]?.context?.preview ?? "";
          
          if (!contextId) return;

          setIsLoadingCustomActions(true);

          const loadedGeneralSettings = await loadGeneralSettings(
            client,
            contextId,
            pageLanguage as "en-CA" | "fr-CA"
          );

          const loadedSettings = await loadSettings(
            client,
            contextId,
            pageLanguage as "en-CA" | "fr-CA"
          );

          const loadedAdditionalChecks = await loadAdditionalStatusChecks(
            client,
            contextId,
            pageLanguage as "en-CA" | "fr-CA"
          );

          const loadedCustomActions = await loadCustomActions(
            client,
            contextId,
            pageLanguage as "en-CA" | "fr-CA"
          );

          setGeneralSettings(loadedGeneralSettings);
          setDisplaySettings(loadedSettings);
          setAdditionalChecks(loadedAdditionalChecks);
          setCustomActions(loadedCustomActions);
        } catch (err) {
          console.error("Error loading initial settings:", err);
        } finally {
          setIsLoadingCustomActions(false);
        }
      };

      void loadInitialSettings();
    }
  }, [client, appContext, pagesContext]);

  const handleSettingsSaved = (newSettings: DisplaySettings, newGeneralSettings: GeneralSettings, newAdditionalChecks: AdditionalStatusChecks, newCustomActions: CustomActions) => {
    setDisplaySettings(newSettings);
    setGeneralSettings(newGeneralSettings);
    setAdditionalChecks(newAdditionalChecks);
    setIsLoadingCustomActions(true);
    setCustomActions(newCustomActions);
    // Increment refresh key to trigger status checks reload
    setStatusRefreshKey(prev => prev + 1);
    // Reset loading state after a brief moment to show the update
    setTimeout(() => {
      setIsLoadingCustomActions(false);
    }, 300);
  };

  const pageId = pagesContext?.pageInfo?.id;
  const pageVersion = pagesContext?.pageInfo?.version;
  const pagePath = pagesContext?.pageInfo?.path;
  const pageLanguage = pagesContext?.pageInfo?.language;
  const pageName = pagesContext?.pageInfo?.name;
  const siteName = pagesContext?.siteInfo?.name;
  const pageRoute = pagesContext?.pageInfo?.route;

  if (error) {
    return (
      <div className="p-4 text-center text-danger-fg">
        Failed to initialize.
      </div>
    );
  }

  if (
    !isInitialized ||
    !client ||
    !appContext ||
    !pageId ||
    !pagePath ||
    !pageLanguage
  ) {
    return (
      <div className="p-8 text-center text-subtle-text">
        Waiting for page context…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {displaySettings.showPublishingStatus && (
        <PublishingStatus
          key={statusRefreshKey}
          client={client}
          appContext={appContext}
          pageId={pageId}
          pageVersion={pageVersion ?? 1}
          pagePath={pagePath}
          language={pageLanguage}
          additionalChecks={additionalChecks}
          generalSettings={generalSettings}
        />
      )}
      {displaySettings.showPublishingActions && (
        <PublishingActions
          client={client}
          appContext={appContext}
          pageId={pageId}
          pageVersion={pageVersion ?? 1}
          pagePath={pagePath}
          pageName={pageName ?? 'Page'}
          language={pageLanguage}
          showPublish={displaySettings.showPublish}
          showUnpublish={displaySettings.showUnpublish}
          showDelete={displaySettings.showDelete}
          customActions={customActions.actions}
          isLoadingCustomActions={isLoadingCustomActions}
        />
      )}
      {displaySettings.showPublishingActivity && (
        <PublishingJobs
          client={client}
          appContext={appContext}
        />
      )}
      {displaySettings.showPublishingContext && (
        <PublishingContext
          siteName={siteName ?? 'website'}
          pageId={pageId}
          pageRoute={pageRoute ?? '/'}
          language={pageLanguage}
          client={client}
          appContext={appContext}
          datasources={datasources}
          setDatasources={setDatasources}
        />
      )}
      
      {/* Settings Link */}
      <div className="flex items-center justify-end gap-2 py-2">
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors cursor-pointer"
        >
          <Icon path={mdiCog} size={0.8} />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Modal */}
      {appContext && pageLanguage && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onSettingsSaved={handleSettingsSaved}
          client={client}
          appContext={appContext}
          language={pageLanguage}
        />
      )}
    </div>
  );
}

export default PagesContextPanel;
