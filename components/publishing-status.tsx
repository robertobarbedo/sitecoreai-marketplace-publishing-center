"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ClientSDK,
  ApplicationContext,
} from "@sitecore-marketplace-sdk/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/lib/icon";
import {
  mdiRefresh,
  mdiCheckCircleOutline,
  mdiAlertOutline,
  mdiCloseCircleOutline,
  mdiAlertCircleOutline,
  mdiLoading,
  mdiOpenInNew,
} from "@mdi/js";
import {
  queryDeliveryItemUpdated,
} from "@/src/utils/sitecore-graphql";
import type { AdditionalStatusChecks, GeneralSettings } from "@/src/utils/sitecore-settings";

type StatusValue =
  | "loading"
  | "updated"
  | "outdated"
  | "missing"
  | "error"
  | "pending"
  | "present";

interface StatusInfo {
  status: StatusValue;
  timestamp?: string | null;
}

export interface PublishingStatusProps {
  client: ClientSDK;
  appContext: ApplicationContext;
  pageId: string;
  pageVersion: number;
  pagePath: string;
  language: string;
  additionalChecks?: AdditionalStatusChecks;
  generalSettings?: GeneralSettings;
}

const STATUS_DISPLAY: Record<
  StatusValue,
  { border: string; fg: string; icon: string | null; label: string }
> = {
  updated: {
    border: "border-success-border",
    fg: "text-success-fg",
    icon: mdiCheckCircleOutline,
    label: "Updated",
  },
  outdated: {
    border: "border-warning-border",
    fg: "text-orange-500",
    icon: mdiAlertOutline,
    label: "Outdated",
  },
  missing: {
    border: "border-danger-border",
    fg: "text-danger-fg",
    icon: mdiCloseCircleOutline,
    label: "Missing",
  },
  error: {
    border: "border-danger-border",
    fg: "text-danger-fg",
    icon: mdiAlertCircleOutline,
    label: "Error",
  },
  present: {
    border: "border-success-border",
    fg: "text-success-fg",
    icon: mdiCheckCircleOutline,
    label: "Found",
  },
  loading: {
    border: "border",
    fg: "text-black",
    icon: mdiLoading,
    label: "Checking\u2026",
  },
  pending: {
    border: "border",
    fg: "text-black",
    icon: null,
    label: "\u2014",
  },
};

function formatTimestamp(raw: string): string {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function StatusCard({
  label,
  info,
  href,
}: {
  label: string;
  info: StatusInfo;
  href?: string;
}) {
  const display = STATUS_DISPLAY[info.status];
  const timestamp =
    info.timestamp && info.status !== "loading"
      ? formatTimestamp(info.timestamp)
      : null;

  const inner = (
    <div
      className="flex w-full items-center gap-3 rounded-md border border-gray-200 px-3 py-2.5"
    >
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center ${display.fg}`}>
        {display.icon && (
          <div className={info.status === "loading" ? "animate-spin" : undefined}>
            <Icon path={display.icon} size={1.2} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col text-black">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs opacity-60">
          {timestamp ?? display.label}
        </span>
      </div>
      {href && (
        <div className="flex-shrink-0 text-gray-400">
          <Icon path={mdiOpenInNew} size={0.75} />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-opacity hover:opacity-80"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

export function PublishingStatus({
  client,
  appContext,
  pageId,
  pageVersion,
  pagePath,
  language,
  additionalChecks,
  generalSettings,
}: PublishingStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [editingStatus, setEditingStatus] = useState<StatusInfo>({
    status: "pending",
  });
  const [liveStatus, setLiveStatus] = useState<StatusInfo>({
    status: "pending",
  });
  const [websiteStatus, setWebsiteStatus] = useState<StatusInfo>({
    status: "pending",
  });
  const [additionalStatuses, setAdditionalStatuses] = useState<Map<string, StatusInfo>>(() => {
    const initial = new Map<string, StatusInfo>();
    if (additionalChecks?.checks) {
      for (const check of additionalChecks.checks) {
        initial.set(check.id, { status: "loading" });
      }
    }
    return initial;
  });

  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);

  // Cache the live URL so Website can be fetched after the Live fetch.
  const liveUrlRef = useRef<string | null>(null);

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

  const fetchStatuses = useCallback(async (isInitialLoad = false): Promise<void> => {
    if (!pagePath || !language) return;
    const contextIds = getContextIds();
    if (!contextIds.preview) return;

    // On first load show spinners; during polling keep the last known badges.
    if (isInitialLoad) {
      setEditingStatus({ status: "loading" });
      setLiveStatus({ status: "loading" });
      setWebsiteStatus({ status: "loading" });
      liveUrlRef.current = null;
      setWebsiteUrl(null);
    }

    // 1. Editing — always "Updated"; fetch from the authoring endpoint.
    //    We always fetch this because its timestamp is needed for comparisons below.
    let editingTimestamp: string | null = null;
    try {
      if (pageId && contextIds.preview) {
        const graphqlQuery = {
          query: `
            query {
              item(where: { database: "master", itemId: "${pageId}", language: "${language}" }) {
                updatedField: field(name: "__Updated") { value }
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
                  updatedField?: { value?: string };
                };
              };
            };
          }
        )?.data?.data?.item;
        editingTimestamp = item?.updatedField?.value ?? null;
      }
      setEditingStatus({ status: "updated", timestamp: editingTimestamp ?? undefined });
    } catch {
      setEditingStatus({ status: "updated" });
    }

    // 2. Live Database
    try {
      if (!contextIds.live) {
        setLiveStatus({ status: "missing" });
      } else {
        const result = await queryDeliveryItemUpdated(
          client,
          contextIds.live,
          "xmc.live.graphql",
          pagePath,
          language,
        );
        if (!result) {
          setLiveStatus({ status: "missing" });
        } else {
          liveUrlRef.current = result.url;
          setWebsiteUrl(result.url ?? null);
          if (!result.updated) {
            setLiveStatus({ status: "missing" });
          } else if (editingTimestamp && result.updated === editingTimestamp) {
            setLiveStatus({ status: "updated", timestamp: result.updated });
          } else {
            setLiveStatus({ status: "outdated", timestamp: result.updated });
          }
        }
      }
    } catch {
      setLiveStatus({ status: "error" });
    }

    // 3. Website
    const liveUrl = liveUrlRef.current;
    if (!liveUrl) {
      setWebsiteStatus({ status: "missing" });
    } else {
      try {
        const metaName = generalSettings?.timestampMetaName || "Last-Modified";
        // Vercel Deployment Protection: append the bypass query string so
        // protected deployments answer with the page instead of the auth wall.
        const bypassPassword = generalSettings?.vercelProtectionBypass?.trim();
        let fetchUrl = liveUrl;
        if (bypassPassword) {
          const separator = liveUrl.includes("?") ? "&" : "?";
          fetchUrl = `${liveUrl}${separator}x-vercel-protection-bypass=${encodeURIComponent(bypassPassword)}&x-vercel-set-bypass-cookie=true`;
        }
        const res = await fetch(
          `/api/fetch-page?url=${encodeURIComponent(fetchUrl)}&metaName=${encodeURIComponent(metaName)}`,
        );
        const data = (await res.json()) as {
          status: number;
          updated: string | null;
        };

        if (data.status === 404) {
          setWebsiteStatus({ status: "missing" });
        } else if (data.status >= 200 && data.status < 300) {
          if (!data.updated) {
            setWebsiteStatus({ status: "missing" });
          } else if (editingTimestamp && data.updated === editingTimestamp) {
            setWebsiteStatus({ status: "updated", timestamp: data.updated });
          } else {
            setWebsiteStatus({ status: "outdated", timestamp: data.updated });
          }
        } else {
          setWebsiteStatus({ status: "error" });
        }
      } catch {
        setWebsiteStatus({ status: "error" });
      }
    }

    // 4. Additional Status Checks
    if (additionalChecks?.checks) {
      // First, set all checks to loading state if it's initial load
      if (isInitialLoad) {
        const loadingStatuses = new Map<string, StatusInfo>();
        for (const check of additionalChecks.checks) {
          loadingStatuses.set(check.id, { status: "loading" });
        }
        setAdditionalStatuses(loadingStatuses);
      }

      // Then fetch all checks in parallel
      const checkPromises = additionalChecks.checks.map(async (check) => {
        if (!check.url || !check.name) {
          return { id: check.id, status: "error" as StatusValue };
        }

        try {
          // Replace tokens in the URL
          // ID should be lowercase, no curly braces, with dashes
          const normalizedId = pageId.toLowerCase().replace(/[{}]/g, '');
          let processedUrl = check.url
            .replace(/PATH/g, pagePath)
            .replace(/ID/g, normalizedId)
            .replace(/LANGUAGE/g, language);

          const res = await fetch(
            `/api/fetch-custom-status?url=${encodeURIComponent(processedUrl)}`,
          );
          const data = (await res.json()) as {
            status: number;
            content: any;
            error?: string;
          };

          if (data.status === 404) {
            return { id: check.id, status: "missing" as StatusValue };
          } else if (data.status >= 200 && data.status < 300) {
            // Check if content is a JSON object with a single date string value
            if (
              data.content &&
              typeof data.content === "object" &&
              !Array.isArray(data.content)
            ) {
              const keys = Object.keys(data.content);
              if (keys.length === 1) {
                const value = data.content[keys[0]];
                // Check if it matches date format YYYY-MM-DD HH:MM:SS
                const datePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (typeof value === "string" && datePattern.test(value)) {
                  // Convert to format matching editing timestamp (YYYYMMDDTHHMMSS)
                  const timestamp = value.replace(/[-: ]/g, "").replace(/(\d{8})(\d{6})/, "$1T$2");
                  if (editingTimestamp && timestamp === editingTimestamp) {
                    return { id: check.id, status: "updated" as StatusValue, timestamp: value };
                  } else {
                    return { id: check.id, status: "outdated" as StatusValue, timestamp: value };
                  }
                }
              }
            }
            // If not the specific JSON format, mark as "present"
            return { id: check.id, status: "present" as StatusValue };
          } else {
            return { id: check.id, status: "missing" as StatusValue };
          }
        } catch {
          return { id: check.id, status: "missing" as StatusValue };
        }
      });

      const results = await Promise.all(checkPromises);
      const newAdditionalStatuses = new Map<string, StatusInfo>();
      for (const result of results) {
        newAdditionalStatuses.set(result.id, { 
          status: result.status, 
          timestamp: (result as any).timestamp 
        });
      }

      setAdditionalStatuses(newAdditionalStatuses);
    }
  }, [client, pageId, pagePath, language, getContextIds, additionalChecks, generalSettings]);

  // Fetch on mount and when the selected page changes or additional checks change
  useEffect(() => {
    liveUrlRef.current = null;
    fetchStatuses(true);
  }, [pageId, pagePath, language, fetchStatuses]);

  // Refresh cards when a publishing job finishes
  useEffect(() => {
    const onJobFinished = () => {
      void fetchStatuses(true);
    };
    window.addEventListener("publishing-job-finished", onJobFinished);
    return () => window.removeEventListener("publishing-job-finished", onJobFinished);
  }, [fetchStatuses]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await fetchStatuses(true);
    setIsRefreshing(false);
  }, [isRefreshing, fetchStatuses]);

  return (
    <Card style="outline" padding="sm" className="gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Status</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh"
        >
          <div className={isRefreshing ? "animate-spin" : undefined}>
            <Icon path={mdiRefresh} size={0.65} />
          </div>
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2">
        <StatusCard label="Editing" info={editingStatus} />
        <StatusCard label="Live Database" info={liveStatus} />
        <StatusCard label="Website" info={websiteStatus} href={websiteUrl ?? undefined} />
        
        {additionalChecks?.checks.map((check) => {
          const status = additionalStatuses.get(check.id) ?? { status: "loading" };
          return (
            <StatusCard
              key={check.id}
              label={check.name || "Unnamed Check"}
              info={status}
              href={check.url}
            />
          );
        })}
      </div>

      {/*liveStatus.status === "outdated" && (
        <>
          <Separator />
          <p className="text-sm text-warning-fg">
            The live database is out of sync with the authored version. Publishing the page will resolve this.
          </p>
        </>
      )*/}
    </Card>
  );
}
