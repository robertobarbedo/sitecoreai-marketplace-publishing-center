"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ClientSDK,
  ApplicationContext,
} from "@sitecore-marketplace-sdk/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/lib/icon";
import { 
  mdiCloseCircleOutline,
  mdiCloudUploadOutline,
  mdiCloudOffOutline,
  mdiDeleteOutline,
  mdiPlayCircleOutline,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiLoading,
  mdiSend,
} from "@mdi/js";
import {
  queryDeliveryItemUpdated,
  updateItemField,
  deleteItem,
  resolveSiteRootPath,
} from "@/src/utils/sitecore-graphql";
import type { ActionConfig, PublishingOptionsSettings } from "@/src/utils/sitecore-settings";

export interface PublishingActionsProps {
  client: ClientSDK;
  appContext: ApplicationContext;
  pageId: string;
  pageVersion: number;
  pagePath: string;
  pageName: string;
  language: string;
  showPublish?: boolean;
  showUnpublish?: boolean;
  showDelete?: boolean;
  showForcePublish?: boolean;
  customActions?: ActionConfig[];
  isLoadingCustomActions?: boolean;
  publishingOptions?: PublishingOptionsSettings;
  supportedLanguages?: string[];
}

export function PublishingActions({
  client,
  appContext,
  pageId,
  pageVersion,
  pagePath,
  pageName,
  language,
  showPublish = true,
  showUnpublish = true,
  showDelete = true,
  showForcePublish = false,
  customActions = [],
  isLoadingCustomActions = false,
  publishingOptions,
  supportedLanguages = [],
}: PublishingActionsProps) {
  const [isUnpublishable, setIsUnpublishable] = useState(false);
  const [isUnpublishableUpdating, setIsUnpublishableUpdating] = useState(false);
  const [unpublishPhase, setUnpublishPhase] = useState<"idle" | "confirming">("idle");

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [deletePhase, setDeletePhase] = useState<
    "idle" | "checking" | "blocked" | "confirming" | "deleting" | "deleted"
  >("idle");

  const [actionStates, setActionStates] = useState<Record<string, {loading: boolean, error: string | null, success: string | null}>>({});
  const websiteUrlRef = useRef<string | null>(null);
  const actionTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const getContextIds = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string; live?: string } }>
      | undefined;
    const context = resourceAccess?.[0]?.context;
    return {
      preview: context?.preview ?? "",
      live: context?.live ?? "",
    };
  }, [appContext]);

  // Fetch the initial unpublishable state and website URL when page changes
  useEffect(() => {
    const fetchInitialData = async () => {
      const contextIds = getContextIds();
      if (!pageId || !contextIds.preview) return;

      // Fetch unpublishable state
      try {
        const graphqlQuery = {
          query: `
            query {
              item(where: { database: "master", itemId: "${pageId}", language: "${language}" }) {
                hideVersionField: field(name: "__Hide version") { value }
              }
            }
          `,
        };
        const response = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId: contextIds.preview },
            body: graphqlQuery,
          },
        });
        const item = (
          response as {
            data?: {
              data?: {
                item?: {
                  hideVersionField?: { value?: string };
                };
              };
            };
          }
        )?.data?.data?.item;
        setIsUnpublishable(item?.hideVersionField?.value === "1");
      } catch {
        // Ignore errors during fetch
      }

      // Fetch website URL from live database
      if (contextIds.live) {
        try {
          const result = await queryDeliveryItemUpdated(
            client,
            contextIds.live,
            "xmc.live.graphql",
            pagePath,
            language,
          );
          if (result?.url) {
            websiteUrlRef.current = result.url;
          }
        } catch {
          // Ignore errors, will fall back to env variable if needed
        }
      }
    };

    setDeletePhase("idle");
    setUnpublishPhase("idle");
    void fetchInitialData();
  }, [client, pageId, pagePath, language, getContextIds]);


  const handleUnpublish = useCallback(() => {
    setUnpublishPhase("confirming");
  }, []);

  const handleUnpublishConfirm = useCallback(async () => {
    if (!pageId || !pagePath || !pageName || isUnpublishableUpdating || isPublishing) return;
    
    setUnpublishPhase("idle");
    setIsUnpublishableUpdating(true);
    setIsPublishing(true);
    setPublishError(null);

    try {
      const contextIds = getContextIds();
      if (!contextIds.preview) {
        throw new Error("No preview context available");
      }

      // First, set __Hide version to "1"
      await updateItemField(
        client,
        contextIds.preview,
        pageId,
        pagePath,
        "__Hide version",
        "1",
        language as "en-CA" | "fr-CA",
        pageVersion,
      );
      setIsUnpublishable(true);

      // Then publish with __Hide version set (this unpublishes it)
      const response = await client.mutate("xmc.authoring.graphql", {
        params: {
          query: { sitecoreContextId: contextIds.preview },
          body: {
            query: `
              mutation {
                publishItem(input: {
                  rootItemId: "${pageId}"
                  languages: ["${language}"]
                  targetDatabases: "experienceedge"
                  publishItemMode: SMART
                  publishRelatedItems: true
                  publishSubItems: false
                  displayName: "Unpublish: ${pageName.replace(/"/g, '\\"')}"
                }) {
                  operationId
                }
              }
            `,
          },
        },
      });

      type PublishResponse = {
        data?: {
          data?: {
            publishItem?: {
              operationId?: string;
            };
          };
        };
      };

      const operationId = (response as PublishResponse)?.data?.data?.publishItem?.operationId;

      if (!operationId) {
        throw new Error("No operation ID returned");
      }

      // Keep buttons disabled briefly
      setTimeout(() => {
        setIsUnpublishableUpdating(false);
        setIsPublishing(false);
      }, 5000);
    } catch (error) {
      console.error("Unpublish error:", error);
      setPublishError(
        error instanceof Error ? error.message : "Failed to unpublish"
      );
      setIsUnpublishableUpdating(false);
      setIsPublishing(false);
    }
  }, [
    client,
    pageId,
    pagePath,
    pageName,
    language,
    pageVersion,
    isUnpublishableUpdating,
    isPublishing,
    getContextIds,
  ]);

  const handleDeleteClick = useCallback(async () => {
    if (deletePhase === "checking" || deletePhase === "deleting") return;
    setDeletePhase("checking");

    const contextIds = getContextIds();
    let presentInLive = false;

    try {
      if (contextIds.live) {
        const result = await queryDeliveryItemUpdated(
          client,
          contextIds.live,
          "xmc.live.graphql",
          pagePath,
          language,
        );
        presentInLive = result !== null && result.updated !== null;
      }
    } catch {
      presentInLive = true;
    }

    setDeletePhase(presentInLive ? "blocked" : "confirming");
  }, [client, pagePath, language, deletePhase, getContextIds]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pagePath) return;
    const contextIds = getContextIds();
    if (!contextIds.preview) return;

    setDeletePhase("deleting");
    try {
      await deleteItem(client, contextIds.preview, pagePath);
      setDeletePhase("deleted");
    } catch {
      setDeletePhase("idle");
    }
  }, [client, pagePath, getContextIds]);

  type PublishResponse = {
    data?: {
      data?: {
        publishItem?: {
          operationId?: string;
        };
      };
    };
  };

  const executePublishMutation = useCallback(async (
    contextId: string,
    opts: {
      rootItemId?: string;
      rootItemPath?: string;
      mode: string;
      relatedItems: boolean;
      subItems: boolean;
      languages: string[];
      displayName: string;
    },
  ): Promise<string> => {
    const langList = opts.languages.map((l) => `"${l}"`).join(", ");
    const rootParam = opts.rootItemId
      ? `rootItemId: "${opts.rootItemId}"`
      : `rootItemPath: "${opts.rootItemPath!.replace(/"/g, '\\"')}"`;

    const response = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId: contextId },
        body: {
          query: `
            mutation {
              publishItem(input: {
                ${rootParam}
                languages: [${langList}]
                targetDatabases: "experienceedge"
                publishItemMode: ${opts.mode}
                publishRelatedItems: ${opts.relatedItems}
                publishSubItems: ${opts.subItems}
                displayName: "${opts.displayName.replace(/"/g, '\\"')}"
              }) {
                operationId
              }
            }
          `,
        },
      },
    });

    const operationId = (response as PublishResponse)?.data?.data?.publishItem?.operationId;
    if (!operationId) {
      throw new Error("No operation ID returned");
    }
    return operationId;
  }, [client]);

  const handlePublish = useCallback(async () => {
    if (!pageId || !pagePath || !pageName || isPublishing) return;

    const config = publishingOptions?.publish;
    const mode = config?.mode ?? "SMART";
    const relatedItems = config?.relatedItems ?? true;
    const subItems = config?.subItems ?? false;
    const langOption = config?.languages ?? "current";
    const targets = config?.targets ?? { currentItem: true, currentItemData: false, siteDataFolder: false, fullSite: false };

    setIsPublishing(true);
    setPublishError(null);

    try {
      const contextIds = getContextIds();
      if (!contextIds.preview) {
        throw new Error("No preview context available");
      }

      if (isUnpublishable) {
        await updateItemField(
          client,
          contextIds.preview,
          pageId,
          pagePath,
          "__Hide version",
          "",
          language as "en-CA" | "fr-CA",
          pageVersion,
        );
        setIsUnpublishable(false);
      }

      const languages = langOption === "all" && supportedLanguages.length > 0
        ? supportedLanguages
        : [language];

      if (targets.currentItem) {
        await executePublishMutation(contextIds.preview, {
          rootItemId: pageId,
          mode,
          relatedItems,
          subItems,
          languages,
          displayName: `Publish: ${pageName}`,
        });
      }

      if (targets.currentItemData) {
        await executePublishMutation(contextIds.preview, {
          rootItemPath: pagePath + "/Data",
          mode,
          relatedItems,
          subItems: true,
          languages,
          displayName: `Publish Data: ${pageName}`,
        });
      }

      if (targets.siteDataFolder) {
        const siteRoot = resolveSiteRootPath(pagePath);
        await executePublishMutation(contextIds.preview, {
          rootItemPath: siteRoot + "/Data",
          mode,
          relatedItems,
          subItems: true,
          languages,
          displayName: "Publish Site Data",
        });
      }

      setTimeout(() => {
        setIsPublishing(false);
      }, 5000);
    } catch (error) {
      console.error("Publish error:", error);
      setPublishError(
        error instanceof Error ? error.message : "Failed to publish"
      );
      setIsPublishing(false);
    }
  }, [
    client,
    pageId,
    pagePath,
    pageName,
    language,
    pageVersion,
    isPublishing,
    isUnpublishable,
    getContextIds,
    publishingOptions,
    supportedLanguages,
    executePublishMutation,
  ]);

  const handleForcePublish = useCallback(async () => {
    if (!pageId || !pagePath || !pageName || isPublishing) return;

    const config = publishingOptions?.forcePublish;
    const mode = config?.mode ?? "FULL";
    const relatedItems = config?.relatedItems ?? true;
    const subItems = config?.subItems ?? false;
    const langOption = config?.languages ?? "current";
    const targets = config?.targets ?? { currentItem: true, currentItemData: false, siteDataFolder: false, fullSite: false };

    setIsPublishing(true);
    setPublishError(null);

    try {
      const contextIds = getContextIds();
      if (!contextIds.preview) {
        throw new Error("No preview context available");
      }

      if (isUnpublishable) {
        await updateItemField(
          client,
          contextIds.preview,
          pageId,
          pagePath,
          "__Hide version",
          "",
          language as "en-CA" | "fr-CA",
          pageVersion,
        );
        setIsUnpublishable(false);
      }

      const languages = langOption === "all" && supportedLanguages.length > 0
        ? supportedLanguages
        : [language];

      if (targets.fullSite) {
        const siteRoot = resolveSiteRootPath(pagePath);
        await executePublishMutation(contextIds.preview, {
          rootItemPath: siteRoot,
          mode,
          relatedItems,
          subItems: true,
          languages,
          displayName: "Force Publish: Full Site",
        });
      } else {
        if (targets.currentItem) {
          await executePublishMutation(contextIds.preview, {
            rootItemId: pageId,
            mode,
            relatedItems,
            subItems,
            languages,
            displayName: `Force Publish: ${pageName}`,
          });
        }

        if (targets.currentItemData) {
          await executePublishMutation(contextIds.preview, {
            rootItemPath: pagePath + "/Data",
            mode,
            relatedItems,
            subItems: true,
            languages,
            displayName: `Force Publish Data: ${pageName}`,
          });
        }

        if (targets.siteDataFolder) {
          const siteRoot = resolveSiteRootPath(pagePath);
          await executePublishMutation(contextIds.preview, {
            rootItemPath: siteRoot + "/Data",
            mode,
            relatedItems,
            subItems: true,
            languages,
            displayName: "Force Publish Site Data",
          });
        }
      }

      setTimeout(() => {
        setIsPublishing(false);
      }, 5000);
    } catch (error) {
      console.error("Force publish error:", error);
      setPublishError(
        error instanceof Error ? error.message : "Failed to force publish"
      );
      setIsPublishing(false);
    }
  }, [
    client,
    pageId,
    pagePath,
    pageName,
    language,
    pageVersion,
    isPublishing,
    isUnpublishable,
    getContextIds,
    publishingOptions,
    supportedLanguages,
    executePublishMutation,
  ]);

  const handleActionClick = useCallback(async (action: ActionConfig) => {
    if (!action.url || actionStates[action.id]?.loading) return;

    // Clear any existing timeout for this action
    if (actionTimeoutsRef.current[action.id]) {
      clearTimeout(actionTimeoutsRef.current[action.id]);
      delete actionTimeoutsRef.current[action.id];
    }

    setActionStates(prev => ({
      ...prev,
      [action.id]: { loading: true, error: null, success: null }
    }));

    try {
      const websiteUrl = websiteUrlRef.current;
      let websitePath = pagePath;
      let baseUrl = process.env.NEXT_PUBLIC_SITE_LIVE_URL || "";
      
      if (websiteUrl) {
        try {
          const url = new URL(websiteUrl);
          websitePath = url.pathname;
          baseUrl = `${url.protocol}//${url.host}`;
        } catch {
          websitePath = pagePath;
        }
      }

      const cleanPageId = pageId.toLowerCase().replace(/[{}]/g, "");

      let finalUrl = action.url
        .replace(/PATH/g, websitePath)
        .replace(/ID/g, cleanPageId)
        .replace(/LANGUAGE/g, language);

      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = baseUrl + (finalUrl.startsWith("/") ? "" : "/") + finalUrl;
      }

      // Use proxy API route to avoid CORS issues
      const proxyUrl = `/api/proxy-action?url=${encodeURIComponent(finalUrl)}`;
      const response = await fetch(proxyUrl);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Request failed: ${result.status} ${result.statusText}`);
      }

      // Success state
      const successMessage = `Action completed successfully (${result.status})`;
      setActionStates(prev => ({
        ...prev,
        [action.id]: { loading: false, error: null, success: successMessage }
      }));

      // Reset to neutral after 5 seconds
      actionTimeoutsRef.current[action.id] = setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [action.id]: { loading: false, error: null, success: null }
        }));
        delete actionTimeoutsRef.current[action.id];
      }, 5000);
    } catch (error) {
      console.error("Action error:", error);
      const errorMessage = error instanceof Error ? error.message : "Action failed";
      setActionStates(prev => ({
        ...prev,
        [action.id]: { 
          loading: false, 
          error: errorMessage,
          success: null
        }
      }));

      // Reset to neutral after 5 seconds
      actionTimeoutsRef.current[action.id] = setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [action.id]: { loading: false, error: null, success: null }
        }));
        delete actionTimeoutsRef.current[action.id];
      }, 5000);
    }
  }, [pagePath, pageId, language, actionStates]);

  if (deletePhase === "deleted") {
    return (
      <Card style="outline" padding="sm" className="gap-3">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg">
            <Icon path={mdiCloseCircleOutline} size={1.5} className="text-danger-fg" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-black">Page deleted</span>
            <p className="text-xs text-gray-500">
              Use the content tree on the left to select another page.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style="outline" padding="sm" className="gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Actions</span>
      </div>

      {/* Publish Button */}
      {showPublish && (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            variant="outline"
            colorScheme="primary"
            disabled={isPublishing}
            onClick={() => void handlePublish()}
            className="w-full"
          >
            <Icon path={mdiCloudUploadOutline} size={0.85} />
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
          {publishError && (
            <p className="text-sm text-danger-fg">{publishError}</p>
          )}
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Unpublish Card */}
        {showUnpublish && unpublishPhase === "idle" && (
          <button
            type="button"
            disabled={isUnpublishable || isUnpublishableUpdating || isPublishing}
            onClick={() => void handleUnpublish()}
            className="flex flex-row items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 flex-shrink-0">
              <Icon path={mdiCloudOffOutline} size={0.9} className="text-indigo-600" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-900">
                {isUnpublishableUpdating ? "Unpublishing..." : "Unpublish"}
              </span>
              <span className="text-xs text-gray-500">Take page offline</span>
            </div>
          </button>
        )}

        {/* Delete Page Card */}
        {showDelete && (
          <button
            type="button"
            disabled={deletePhase === "checking" || deletePhase === "deleting"}
            onClick={() => void handleDeleteClick()}
            className="flex flex-row items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
              <Icon path={mdiDeleteOutline} size={0.9} className="text-red-600" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-900">
                {deletePhase === "checking"
                  ? "Checking…"
                  : deletePhase === "deleting"
                    ? "Deleting…"
                    : "Delete page"}
              </span>
              <span className="text-xs text-gray-500">Permanently delete</span>
            </div>
          </button>
        )}
      </div>

      {/* Force Publish Button */}
      {showForcePublish && (
        <button
          type="button"
          disabled={isPublishing}
          onClick={() => void handleForcePublish()}
          className="flex flex-row items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 flex-shrink-0">
            <Icon path={mdiSend} size={0.9} className="text-orange-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-gray-900">
              {isPublishing ? "Publishing..." : "Force Publish"}
            </span>
            <span className="text-xs text-gray-500">Slower; use if Publish isn&apos;t working</span>
          </div>
        </button>
      )}

      {/* Custom Action Buttons */}
      {(customActions.length > 0 || isLoadingCustomActions) && (
        <div className="flex flex-col gap-3">
          {isLoadingCustomActions ? (
            <button
              type="button"
              disabled
              className="flex flex-row items-center gap-3 p-3 rounded-lg border border-gray-200 transition-colors opacity-50 cursor-not-allowed text-left w-full"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 flex-shrink-0">
                <div className="animate-spin">
                  <Icon path={mdiLoading} size={0.9} className="text-gray-600" />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">Loading actions...</span>
                <span className="text-xs text-gray-500">Please wait</span>
              </div>
            </button>
          ) : (
            customActions.map((action) => {
              const state = actionStates[action.id] || { loading: false, error: null, success: null };
              
              // Determine icon and colors based on state
              let iconPath = mdiPlayCircleOutline;
              let iconColor = "text-gray-600";
              let bgColor = "bg-gray-100";
              
              if (state.loading) {
                iconPath = mdiLoading;
                iconColor = "text-gray-600";
                bgColor = "bg-gray-100";
              } else if (state.success) {
                iconPath = mdiCheckCircle;
                iconColor = "text-green-600";
                bgColor = "bg-green-100";
              } else if (state.error) {
                iconPath = mdiAlertCircle;
                iconColor = "text-red-600";
                bgColor = "bg-red-100";
              }
              
              return (
                <div key={action.id} className="relative group">
                  <button
                    type="button"
                    disabled={state.loading || isPublishing}
                    onClick={() => void handleActionClick(action)}
                    className="flex flex-row items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left w-full"
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${bgColor} flex-shrink-0 transition-colors`}>
                      <div className={state.loading ? "animate-spin" : undefined}>
                        <Icon path={iconPath} size={0.9} className={`${iconColor} transition-colors`} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">
                        {state.loading ? "Running..." : action.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {state.success ? "Completed" : state.error ? "Failed" : ""}
                      </span>
                    </div>
                  </button>
                  
                  {/* Tooltip for error messages only */}
                  {state.error && (
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-full max-w-xs pointer-events-none">
                      <div className="p-2 rounded-md text-xs text-white shadow-lg bg-red-600">
                        {state.error}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Unpublish Confirmation Modal */}
      <Dialog open={unpublishPhase === "confirming"} onOpenChange={(open) => !open && setUnpublishPhase("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish page</DialogTitle>
            <DialogDescription>
              You are about to unpublish this page.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">After the page is unpublished:</p>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>No other version of this page will automatically be published.</li>
              <li>Any links pointing to this page may lead to missing or broken content.</li>
              <li>Other languages stay published unless you unpublish them separately.</li>
              <li>Changes may take a few minutes to be reflected due to caching.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUnpublishPhase("idle")}
              disabled={isUnpublishableUpdating || isPublishing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="danger"
              disabled={isUnpublishableUpdating || isPublishing}
              onClick={() => void handleUnpublishConfirm()}
            >
              {isUnpublishableUpdating ? "Unpublishing..." : "Confirm Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Blocked Modal */}
      <Dialog open={deletePhase === "blocked"} onOpenChange={(open) => !open && setDeletePhase("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot delete page</DialogTitle>
            <DialogDescription>
              This item is still published.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              You must unpublish the page before you can delete it. Use the &quot;Unpublish&quot; action first.
            </p>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeletePhase("idle")}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deletePhase === "confirming"} onOpenChange={(open) => !open && setDeletePhase("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              This page will be permanently removed from <strong>all languages</strong>. This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeletePhase("idle")}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="danger"
              onClick={() => void handleDeleteConfirm()}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Messages */}
      {publishError && (
        <p className="text-sm text-danger-fg">{publishError}</p>
      )}
    </Card>
  );
}
