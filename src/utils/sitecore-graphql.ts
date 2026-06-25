import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  SITECORE_DATABASES,
  SITECORE_PATHS,
  ALL_LANGUAGES,
  DEFAULT_LANGUAGE,
  type Language,
} from "@/src/constants";

export interface SitecoreItem {
  itemId: string;
  name: string;
  path: string;
  fields?: { nodes: { name: string; value: string }[] };
}

function escapeGraphQL(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function getSitecoreContextId(
  client: ClientSDK,
): Promise<string> {
  const contextResponse = await client.query("application.context");
  const appContext = contextResponse.data as Record<string, unknown>;
  const resourceAccess = appContext?.resourceAccess as
    | Array<{ context?: { preview?: string } }>
    | undefined;
  return resourceAccess?.[0]?.context?.preview ?? "";
}

export async function queryItemByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query {
            item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}" }) {
              itemId
              name
              path
              fields(ownFields: true, excludeStandardFields: true) {
                nodes { name value }
              }
            }
          }
        `,
      },
    },
  });

  return (response as Record<string, unknown> & { data?: { data?: { item?: SitecoreItem } } })
    .data?.data?.item ?? null;
}

export async function queryItemById(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query {
            item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(itemId)}", language: "${escapeGraphQL(language)}" }) {
              itemId
              name
              path
              fields(ownFields: true, excludeStandardFields: true) {
                nodes { name value }
              }
            }
          }
        `,
      },
    },
  });

  return (response as Record<string, unknown> & { data?: { data?: { item?: SitecoreItem } } })
    .data?.data?.item ?? null;
}

export async function queryItemChildren(
  client: ClientSDK,
  sitecoreContextId: string,
  identifier: { path?: string; itemId?: string },
): Promise<Array<{ itemId: string; name: string; path: string; hasChildren: boolean }>> {
  const where = identifier.path
    ? `path: "${escapeGraphQL(identifier.path)}"`
    : `itemId: "${escapeGraphQL(identifier.itemId!)}"`;

  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query {
            item(where: { database: "${SITECORE_DATABASES.MASTER}", ${where} }) {
              children {
                nodes {
                  itemId
                  name
                  path
                  hasChildren
                }
              }
            }
          }
        `,
      },
    },
  });

  type ChildrenResponse = Record<string, unknown> & {
    data?: {
      data?: {
        item?: { children?: { nodes?: Array<{ itemId: string; name: string; path: string; hasChildren: boolean }> } };
      };
    };
  };

  return (response as ChildrenResponse).data?.data?.item?.children?.nodes ?? [];
}

export async function queryChildrenWithFields(
  client: ClientSDK,
  sitecoreContextId: string,
  parentId: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem[]> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query {
            item(where: { database: "${SITECORE_DATABASES.MASTER}", itemId: "${escapeGraphQL(parentId)}", language: "${escapeGraphQL(language)}" }) {
              children {
                nodes {
                  itemId
                  name
                  path
                  fields(ownFields: false, excludeStandardFields: false) {
                    nodes { name value }
                  }
                }
              }
            }
          }
        `,
      },
    },
  });

  type ChildrenFieldsResponse = Record<string, unknown> & {
    data?: {
      data?: {
        item?: { children?: { nodes?: SitecoreItem[] } };
      };
    };
  };

  return (response as ChildrenFieldsResponse).data?.data?.item?.children?.nodes ?? [];
}

export async function createItem(
  client: ClientSDK,
  sitecoreContextId: string,
  parentId: string,
  templateId: string,
  itemName: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          mutation {
            createItem(input: {
              database: "${SITECORE_DATABASES.MASTER}"
              name: "${escapeGraphQL(itemName)}"
              parent: "${escapeGraphQL(parentId)}"
              templateId: "${escapeGraphQL(templateId)}"
              language: "${escapeGraphQL(language)}"
            }) {
              item {
                itemId
                name
                path
                fields(ownFields: true, excludeStandardFields: true) {
                  nodes { name value }
                }
              }
            }
          }
        `,
      },
    },
  });

  type CreateResponse = Record<string, unknown> & {
    data?: { data?: { createItem?: { item?: SitecoreItem } } };
  };

  return (response as CreateResponse).data?.data?.createItem?.item ?? null;
}

export async function deleteItem(
  client: ClientSDK,
  sitecoreContextId: string,
  itemPath: string,
): Promise<boolean> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          mutation {
            deleteItem(input: {
              database: "${SITECORE_DATABASES.MASTER}"
              path: "${escapeGraphQL(itemPath)}"
              permanently: false
            }) {
              successful
            }
          }
        `,
      },
    },
  });

  type DeleteResponse = Record<string, unknown> & {
    data?: { data?: { deleteItem?: { successful?: boolean } } };
  };

  return (response as DeleteResponse).data?.data?.deleteItem?.successful ?? false;
}

export async function publishItemById(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  languages: string[],
  displayName: string,
): Promise<string | null> {
  const langList = languages.map((l) => `"${l}"`).join(", ");
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          mutation {
            publishItem(input: {
              sourceDatabase: "${SITECORE_DATABASES.MASTER}"
              targetDatabases: ["${SITECORE_DATABASES.EXPERIENCE_EDGE}"]
              rootItemIds: ["${escapeGraphQL(itemId)}"]
              publishSubItems: true
              publishRelatedItems: false
              publishItemMode: FULL
              languages: [${langList}]
              displayName: "${escapeGraphQL(displayName)}"
            }) {
              operationId
            }
          }
        `,
      },
    },
  });

  type PublishItemResponse = Record<string, unknown> & {
    data?: { data?: { publishItem?: { operationId?: string } } };
  };

  return (response as PublishItemResponse).data?.data?.publishItem?.operationId ?? null;
}

export async function publishSite(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<string | null> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          mutation {
            publishItem(input: {
              rootItemPath: "${SITECORE_PATHS.SITE_PUBLISH_ROOT}"
              languages: [${ALL_LANGUAGES.map(lang => `"${lang}"`).join(", ")}]
              targetDatabases: "${SITECORE_DATABASES.EXPERIENCE_EDGE}"
              publishItemMode: SMART
              publishRelatedItems: false
              publishSubItems: true
            }) {
              operationId
            }
          }
        `,
      },
    },
  });

  type PublishResponse = Record<string, unknown> & {
    data?: { data?: { publishItem?: { operationId?: string } } };
  };

  return (response as PublishResponse).data?.data?.publishItem?.operationId ?? null;
}

export type DeliveryEndpoint = "xmc.preview.graphql" | "xmc.live.graphql";

export async function queryDeliveryItemUpdated(
  client: ClientSDK,
  sitecoreContextId: string,
  endpoint: DeliveryEndpoint,
  path: string,
  language: string,
): Promise<{ updated: string | null; url: string | null } | null> {
  const response = await client.mutate(endpoint, {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query {
            item(path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}") {
              field(name: "__Updated") { value }
              url { url }
            }
          }
        `,
      },
    },
  });

  type DeliveryResponse = Record<string, unknown> & {
    data?: {
      data?: {
        item?: {
          field?: { value?: string } | null;
          url?: { url?: string } | null;
        } | null;
      };
    };
  };

  const item = (response as DeliveryResponse).data?.data?.item;
  if (!item) return null;

  return {
    updated: item.field?.value ?? null,
    url: item.url?.url ?? null,
  };
}

export async function updateItemField(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
  version: number = 1,
): Promise<SitecoreItem | null> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          mutation {
            updateItem(input: {
              fields: [
                {
                  name: "${escapeGraphQL(fieldName)}",
                  value: "${escapeGraphQL(fieldValue)}",
                  reset: false
                }
              ]
              database: "${SITECORE_DATABASES.MASTER}"
              itemId: "${escapeGraphQL(itemId)}"
              language: "${escapeGraphQL(language)}"
              path: "${escapeGraphQL(itemPath)}"
              version: ${version}
            }) {
              item {
                name
                itemId
                fields(ownFields: true, excludeStandardFields: true) {
                  nodes { name value }
                }
              }
            }
          }
        `,
      },
    },
  });

  type UpdateResponse = Record<string, unknown> & {
    data?: {
      data?: {
        updateItem?: { item?: SitecoreItem };
      };
    };
  };

  return (response as UpdateResponse).data?.data?.updateItem?.item ?? null;
}

export async function updateItemFieldByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  // First get the item to retrieve its ID and version
  const item = await queryItemByPath(client, sitecoreContextId, itemPath, language);
  
  if (!item) {
    return null;
  }

  // Then use the existing updateItemField function
  return await updateItemField(
    client,
    sitecoreContextId,
    item.itemId,
    itemPath,
    fieldName,
    fieldValue,
    language,
    1
  );
}

/**
 * Derives the site root path from a page's content tree path.
 * e.g. "/sitecore/content/MySite/Home/About" -> "/sitecore/content/MySite"
 */
export function resolveSiteRootPath(pagePath: string): string {
  const segments = pagePath.split("/").filter(Boolean);
  // Expected structure: ["sitecore", "content", "SiteName", ...]
  if (segments.length >= 3) {
    return "/" + segments.slice(0, 3).join("/");
  }
  return pagePath;
}
