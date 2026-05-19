"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApplicationContext, ClientSDK } from "@sitecore-marketplace-sdk/client";
import { Card } from "@/components/ui/card";
import { Icon } from "@/lib/icon";
import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import type { DataSource } from "@/src/types/datasource";

export interface PublishingContextProps {
  siteName: string;
  pageId: string;
  pageRoute: string;
  language: string;
  client: ClientSDK;
  appContext: ApplicationContext;
  datasources: DataSource[];
  setDatasources: (datasources: DataSource[]) => void;
}

interface CommonRoot {
  path: string;
  count: number;
  children: string[];
  itemId?: string;
  loading?: boolean;
}

export function PublishingContext({
  siteName,
  pageId,
  pageRoute,
  language,
  client,
  appContext,
  datasources,
  setDatasources,
}: PublishingContextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenFetched, setHasBeenFetched] = useState(false);
  const [commonRoots, setCommonRoots] = useState<CommonRoot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractDatasources = useCallback((obj: any, sources: Set<string> = new Set()): Set<string> => {
    if (!obj || typeof obj !== 'object') return sources;

    // Check if current object has datasource property
    if (obj.datasource || obj.dataSource) {
      const dsValue = obj.datasource || obj.dataSource;
      if (typeof dsValue === 'string' && dsValue) {
        sources.add(dsValue);
      }
    }

    // Recursively search in arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach(item => extractDatasources(item, sources));
    } else {
      Object.values(obj).forEach(value => extractDatasources(value, sources));
    }

    return sources;
  }, []);

  const isGuid = useCallback((str: string): boolean => {
    // GUID pattern: 8-4-4-4-12 hex digits with optional braces and hyphens
    const guidRegex = /^(\{)?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}(\})?$/i;
    return guidRegex.test(str);
  }, []);

  const findCommonRoots = useCallback((paths: string[]): CommonRoot[] => {
    if (paths.length === 0) return [];

    // Group paths by their parent
    const parentMap = new Map<string, string[]>();

    paths.forEach((path) => {
      // Get all ancestor paths
      const parts = path.split('/').filter(Boolean);
      
      // For each level, track this path as a descendant
      for (let i = 1; i < parts.length; i++) {
        const ancestor = '/' + parts.slice(0, i).join('/');
        if (!parentMap.has(ancestor)) {
          parentMap.set(ancestor, []);
        }
        parentMap.get(ancestor)!.push(path);
      }
    });

    // Find common roots: ancestors with 2+ direct children
    const roots: CommonRoot[] = [];
    const pathSet = new Set(paths);

    parentMap.forEach((descendants, ancestor) => {
      // Check if this ancestor has multiple direct children
      const directChildren = descendants.filter((desc) => {
        // A direct child's parent is this ancestor
        const parentPath = desc.substring(0, desc.lastIndexOf('/'));
        return parentPath === ancestor;
      });

      if (directChildren.length >= 2) {
        // Make sure this isn't a root that's subsumed by a deeper root
        roots.push({
          path: ancestor,
          count: directChildren.length,
          children: directChildren,
        });
      }
    });

    // Sort by path depth (deeper first) and then by count (more children first)
    return roots.sort((a, b) => {
      const depthA = a.path.split('/').length;
      const depthB = b.path.split('/').length;
      if (depthB !== depthA) return depthB - depthA;
      return b.count - a.count;
    });
  }, []);

  const fetchCommonRootIds = useCallback(async (roots: CommonRoot[], sitecoreContextId: string) => {
    // Update all roots to show loading state
    const rootsWithLoading = roots.map(r => ({ ...r, loading: true }));
    setCommonRoots(rootsWithLoading);

    // Fetch IDs for each root
    const updatedRoots = await Promise.all(
      roots.map(async (root) => {
        try {
          const response = await client.mutate("xmc.authoring.graphql", {
            params: {
              query: { sitecoreContextId },
              body: {
                query: `
                  query {
                    item(where: { database: "master", path: "${root.path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", language: "${language}" }) {
                      itemId
                    }
                  }
                `,
              },
            },
          });

          const itemId = (response as any)?.data?.data?.item?.itemId;
          return { ...root, itemId, loading: false };
        } catch (err) {
          console.error(`Error fetching ID for ${root.path}:`, err);
          return { ...root, loading: false };
        }
      })
    );

    setCommonRoots(updatedRoots);
  }, [client, language]);

  const fetchPageDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDatasources([]);
    setCommonRoots([]);

    try {
      // Get the Sitecore context ID
      const resourceAccess = (appContext as any)?.resourceAccess as
        | Array<{ context?: { preview?: string } }>
        | undefined;
      const sitecoreContextId = resourceAccess?.[0]?.context?.preview ?? "";

      if (!sitecoreContextId) {
        throw new Error("No preview context ID found");
      }

      // Execute the layout query using preview endpoint
      const response = await client.mutate("xmc.preview.graphql", {
        params: {
          query: { sitecoreContextId },
          body: {
            query: `
              query {
                layout(site: "${siteName}", routePath: "${pageRoute}", language: "${language}") {
                  item {
                    rendered
                  }
                }
              }
            `,
          },
        },
      });

      // Extract the rendered data
      const layoutData = (response as any)?.data?.data?.layout?.item?.rendered;
      
      if (!layoutData) {
        throw new Error("No layout data found in response");
      }

      // Parse the rendered JSON if it's a string
      const parsedData = typeof layoutData === 'string' ? JSON.parse(layoutData) : layoutData;

      // Extract all datasources
      const foundDatasources = extractDatasources(parsedData);

      // Convert to array format with type classification
      const datasourceList: DataSource[] = Array.from(foundDatasources).map((ds) => {
        const type = isGuid(ds) ? 'guid' : 'path';
        return {
          id: type === 'guid' ? ds : ds.split('/').pop() || ds,
          path: ds,
          type,
        };
      });

      // Find common roots for path-based datasources
      const pathDatasources = datasourceList
        .filter(ds => ds.type === 'path')
        .map(ds => ds.path);
      
      const roots = findCommonRoots(pathDatasources);

      setDatasources(datasourceList);
      setCommonRoots(roots);

      // Fetch IDs for common roots using authoring endpoint
      if (roots.length > 0) {
        await fetchCommonRootIds(roots, sitecoreContextId);
      }
      
      setHasBeenFetched(true);
    } catch (err) {
      console.error("Error fetching page details:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch page details");
    } finally {
      setLoading(false);
    }
  }, [client, appContext, siteName, pageRoute, language, extractDatasources, isGuid, findCommonRoots, fetchCommonRootIds, setDatasources]);

  // Automatically fetch when expanded for the first time
  useEffect(() => {
    if (isExpanded && !hasBeenFetched && !loading) {
      void fetchPageDetails();
    }
  }, [isExpanded, hasBeenFetched, loading, fetchPageDetails]);

  // Reset when page changes
  useEffect(() => {
    setHasBeenFetched(false);
    setDatasources([]);
    setCommonRoots([]);
    setError(null);
  }, [pageId, pageRoute, setDatasources]);

  return (
    <Card style="outline" padding="sm" className="gap-3">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full rounded-md px-1 py-0.5 text-sm hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold">Publishing Context</span>
        <Icon 
          path={isExpanded ? mdiChevronUp : mdiChevronDown} 
          size={0.8} 
          className="text-gray-600"
        />
      </button>

      {isExpanded && (
        <>
          {loading && (
            <div className="text-sm text-gray-600 py-2">
              Loading datasources...
            </div>
          )}

          {/* Context Information */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[100px]">Item ID:</span>
              <span className="text-black font-mono break-all">{pageId}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[100px]">Route:</span>
              <span className="text-black font-mono break-all">{pageRoute}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[100px]">Context Site:</span>
              <span className="text-black font-mono break-all">
                {siteName}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[100px]">Language:</span>
              <span className="text-black">{language}</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Datasources Display */}
          {datasources.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold border-t pt-2">
                Page Datasources ({datasources.length})
              </div>
              
              {/* Common Roots Section */}
              {commonRoots.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  <div className="text-xs font-semibold text-gray-700">
                    Common Roots ({commonRoots.length})
                  </div>
                  <div className="flex flex-col gap-1">
                    {commonRoots.map((root, index) => (
                      <div key={index} className="flex flex-col gap-1 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-black font-mono text-[10px] break-all font-semibold">
                            {root.path}
                          </span>
                          <span className="text-xs text-blue-700 font-semibold ml-2 shrink-0">
                            ({root.count} items)
                          </span>
                        </div>
                        {root.loading && (
                          <div className="text-[9px] text-gray-500 italic ml-2">
                            Loading item ID...
                          </div>
                        )}
                        {root.itemId && (
                          <div className="flex items-start gap-2 ml-2">
                            <span className="font-medium text-gray-600 text-[9px]">Item ID:</span>
                            <span className="text-black font-mono text-[9px] break-all">{root.itemId}</span>
                          </div>
                        )}
                        {!root.loading && !root.itemId && (
                          <div className="text-[9px] text-red-600 ml-2">
                            Failed to fetch item ID
                          </div>
                        )}
                        <div className="text-[9px] text-gray-600 ml-2">
                          {root.children.map((child, i) => (
                            <div key={i}>• {child}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Datasources Section */}
              <div className="text-xs font-semibold text-gray-700">
                All Datasources
              </div>
              <div className="flex flex-col gap-1 text-xs max-h-[300px] overflow-y-auto">
                {datasources.map((ds, index) => (
                  <div key={index} className="flex flex-col gap-1 p-2 bg-gray-50 rounded">
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-gray-600 min-w-[60px]">Type:</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        ds.type === 'guid' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {ds.type.toUpperCase()}
                      </span>
                    </div>
                    {ds.type === 'guid' ? (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-gray-600 min-w-[60px]">GUID:</span>
                        <span className="text-black font-mono text-[10px] break-all">{ds.path}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-gray-600 min-w-[60px]">ID:</span>
                          <span className="text-black font-mono">{ds.id}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-gray-600 min-w-[60px]">Path:</span>
                          <span className="text-black font-mono text-[10px] break-all">{ds.path}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
