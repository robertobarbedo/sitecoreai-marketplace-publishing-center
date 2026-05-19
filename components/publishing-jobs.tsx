"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { Card } from "@/components/ui/card";
import { Icon } from "@/lib/icon";
import { mdiLoading, mdiClockOutline } from "@mdi/js";

const REFRESH_INTERVAL_SECONDS = 10;

interface JobStatus {
  messages: string[] | null;
  processed: number | null;
  jobState: string | null;
}

interface JobNode {
  name: string;
  handle: string;
  status: JobStatus;
  done: boolean;
}

export interface PublishingJobsProps {
  client: ClientSDK;
  appContext: ApplicationContext;
}

const JOB_STATE_STYLES: Record<string, string> = {
  Queued: "bg-gray-100 text-gray-700",
  Running: "bg-blue-100 text-blue-700",
  Finished: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
};

function JobStateBadge({ state }: { state: string | null }) {
  const label = state ?? "Unknown";
  const style = (state && JOB_STATE_STYLES[state]) ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export function PublishingJobs({ 
  client, 
  appContext,
}: PublishingJobsProps) {
  const [jobs, setJobs] = useState<JobNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);
  const [showDetails, setShowDetails] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevJobStatesRef = useRef<Map<string, string | null>>(new Map());

  const getContextId = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string } }>
      | undefined;
    return resourceAccess?.[0]?.context?.preview ?? "";
  }, [appContext]);

  const fetchJobs = useCallback(async () => {
    const sitecoreContextId = getContextId();
    if (!sitecoreContextId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await client.mutate("xmc.authoring.graphql", {
        params: {
          query: { sitecoreContextId },
          body: {
            query: `
              query {
                jobs(input: { jobName: "Publish*" }) {
                  nodes {
                    name
                    handle
                    status {
                      messages
                      processed
                      jobState
                    }
                    done
                  }
                }
              }
            `,
          },
        },
      });

      type JobsResponse = {
        data?: {
          data?: {
            jobs?: {
              nodes?: JobNode[];
            };
          };
        };
      };

      const nodes = (response as JobsResponse)?.data?.data?.jobs?.nodes ?? [];

      const prevStates = prevJobStatesRef.current;
      let anyBecameFinished = false;
      for (const job of nodes) {
        const prev = prevStates.get(job.handle);
        if (job.status.jobState?.toLocaleLowerCase() === "finished" && prev !== undefined && prev?.toLocaleLowerCase() !== "finished") {
          anyBecameFinished = true;
          break;
        }
      }

      const newStates = new Map<string, string | null>();
      for (const job of nodes) {
        newStates.set(job.handle, job.status.jobState);
      }
      prevJobStatesRef.current = newStates;

      if (anyBecameFinished) {
        window.dispatchEvent(new CustomEvent("publishing-job-finished"));
      }

      setJobs(nodes);
    } catch {
      setError("Failed to fetch publishing jobs.");
    } finally {
      setIsLoading(false);
    }
  }, [client, getContextId]);

  // Auto-refresh
  useEffect(() => {
    void fetchJobs();
    setCountdown(REFRESH_INTERVAL_SECONDS);

    intervalRef.current = setInterval(() => {
      void fetchJobs();
      setCountdown(REFRESH_INTERVAL_SECONDS);
    }, REFRESH_INTERVAL_SECONDS * 1000);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : REFRESH_INTERVAL_SECONDS));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchJobs]);

  // Check if there are any active jobs (running or queued)
  const hasActiveJobs = jobs.some(
    (job) =>
      job.status.jobState?.toLowerCase() === "running" ||
      job.status.jobState?.toLowerCase() === "queued"
  );

  return (
    <Card style="outline" padding="sm" className="gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Activity</span>
      </div>

      {/* Summary view */}
      {!showDetails && (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          {hasActiveJobs ? (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
                <div className="animate-spin text-blue-600">
                  <Icon path={mdiLoading} size={1.2} />
                </div>
              </div>
              <span className="text-sm text-gray-700">Publishing in progress...</span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
                <Icon path={mdiClockOutline} size={1.2} className="text-gray-400" />
              </div>
              <span className="text-sm text-gray-700">No activity at the moment</span>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="text-sm text-primary hover:underline"
          >
            See more
          </button>
        </div>
      )}

      {/* Collapsible details table */}
      {showDetails && (
        <>
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="text-xs text-primary hover:underline self-start"
          >
            Hide details
          </button>

          {error && <p className="text-xs text-danger-fg">{error}</p>}

          {isLoading && jobs.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">
              No publishing jobs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="pb-1.5 pr-2 font-medium">Name</th>
                    <th className="pb-1.5 pr-2 font-medium">State</th>
                    <th className="pb-1.5 pr-2 font-medium text-right">Processed</th>
                    <th className="pb-1.5 font-medium">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.handle} className="border-b last:border-0">
                      <td className="max-w-[180px] truncate py-1.5 pr-2" title={job.name}>
                        {job.name}
                      </td>
                      <td className="py-1.5 pr-2">
                        <JobStateBadge state={job.status.jobState} />
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {job.status.processed ?? "—"}
                      </td>
                      <td className="py-1.5">
                        {job.done ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
