export const STRATEGY_CONTENT_FORMAT = "tiptap-json-v1" as const;
export const STRATEGY_DRAFT = "draft" as const;
export const STRATEGY_PUBLISHED = "published" as const;

export const EMPTY_STRATEGY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

export function extractStrategyPlainText(value: unknown) {
  const parts: string[] = [];

  function visit(node: JsonNode) {
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child);
      if (node.type && ["paragraph", "heading", "listItem", "tableRow"].includes(node.type)) {
        parts.push("\n");
      }
    }
  }

  if (value && typeof value === "object") visit(value as JsonNode);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseStrategyDocument(content: string) {
  try {
    const parsed = JSON.parse(content) as JsonNode;
    if (parsed?.type === "doc" && Array.isArray(parsed.content)) return parsed;
  } catch {
    // Legacy or invalid JSON is handled by the Markdown compatibility renderer.
  }
  return EMPTY_STRATEGY_DOCUMENT;
}

export function isValidStrategyDocument(content: string) {
  try {
    const parsed = JSON.parse(content) as JsonNode;
    return parsed?.type === "doc" && Array.isArray(parsed.content);
  } catch {
    return false;
  }
}

export function canWriteStrategyMap(map: { isOpenForPosts: boolean; isDeleted: boolean }) {
  return map.isOpenForPosts && !map.isDeleted;
}

export function collectStrategyAssetIds(content: string, contentFormat: string) {
  if (contentFormat !== STRATEGY_CONTENT_FORMAT) return [];
  let document: JsonNode;
  try {
    document = JSON.parse(content) as JsonNode;
  } catch {
    return [];
  }
  const ids = new Set<string>();
  function visit(node: JsonNode) {
    if (node.type === "image" && typeof node.attrs?.assetId === "string" && node.attrs.assetId) {
      ids.add(node.attrs.assetId);
    }
    node.content?.forEach(visit);
  }
  visit(document);
  return [...ids];
}

export function extractStrategyContentPlainText(content: string, contentFormat: string) {
  if (contentFormat === STRATEGY_CONTENT_FORMAT) {
    try {
      return extractStrategyPlainText(JSON.parse(content));
    } catch {
      return "";
    }
  }
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^:::[^\n]*$/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_>#~|-]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
