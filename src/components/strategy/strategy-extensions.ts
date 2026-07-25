import {
  Extension,
  Node,
  createBlockMarkdownSpec,
  mergeAttributes,
  type Extensions,
} from "@tiptap/core";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Markdown } from "@tiptap/markdown";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { StrategyImageView } from "@/components/strategy/strategy-image-view";
import { RoutineCardExtension } from "@/components/strategy/routine-card-extension";

export const StrategyImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StrategyImageView);
  },
  parseMarkdown(token, helpers) {
    const title = typeof token.title === "string" ? token.title : "";
    const assetMatch = title.match(/^strategy-asset:([^;]+)(?:;align=(left|center|right))?(?:;width=(auto|25%|50%|75%|100%))?$/);
    return helpers.createNode("image", {
      src: token.href,
      alt: token.text,
      title: assetMatch ? null : token.title,
      assetId: assetMatch?.[1] ?? null,
      align: assetMatch?.[2] ?? "center",
      displayWidth: assetMatch?.[3] ?? "auto",
      uploadState: "ready",
    });
  },
  renderMarkdown(node) {
    const src = node.attrs?.src ?? "";
    const alt = node.attrs?.alt ?? "";
    const assetId = node.attrs?.assetId;
    const align = node.attrs?.align ?? "center";
    const displayWidth = node.attrs?.displayWidth ?? "auto";
    const title = assetId ? `strategy-asset:${assetId};align=${align};width=${displayWidth}` : node.attrs?.title ?? "";
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) => attributes.assetId ? { "data-asset-id": attributes.assetId } : {},
      },
      uploadState: {
        default: "ready",
        parseHTML: (element) => element.getAttribute("data-upload-state") ?? "ready",
        renderHTML: (attributes) => ({ "data-upload-state": attributes.uploadState ?? "ready" }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align ?? "center" }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => attributes.caption ? { "data-caption": attributes.caption } : {},
      },
      displayWidth: {
        default: "auto",
        parseHTML: (element) => element.getAttribute("data-display-width") ?? "auto",
        renderHTML: (attributes) => ({
          "data-display-width": attributes.displayWidth ?? "auto",
          style: attributes.displayWidth && attributes.displayWidth !== "auto" ? `width: ${attributes.displayWidth}` : undefined,
        }),
      },
    };
  },
});

const calloutMarkdown = createBlockMarkdownSpec({
  nodeName: "strategyCallout",
  name: "callout",
  defaultAttributes: { tone: "info" },
  allowedAttributes: ["tone"],
});

export const StrategyCallout = Node.create({
  ...calloutMarkdown,
  name: "strategyCallout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return { tone: { default: "info" } };
  },
  parseHTML() {
    return [{ tag: "aside[data-strategy-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-strategy-callout": HTMLAttributes.tone }), 0];
  },
});

const columnMarkdown = createBlockMarkdownSpec({
  nodeName: "strategyColumn",
  name: "column",
});

export const StrategyColumn = Node.create({
  ...columnMarkdown,
  name: "strategyColumn",
  content: "block+",
  isolating: true,
  draggable: true,
  parseHTML() {
    return [{ tag: "div[data-strategy-column]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-strategy-column": "" }), 0];
  },
});

const columnsMarkdown = createBlockMarkdownSpec({
  nodeName: "strategyColumns",
  name: "columns",
  defaultAttributes: { count: 2 },
  allowedAttributes: ["count"],
});

export const StrategyColumns = Node.create({
  ...columnsMarkdown,
  name: "strategyColumns",
  group: "block",
  content: "strategyColumn{2,}",
  isolating: true,
  draggable: true,
  addAttributes() {
    return { count: { default: 2 } };
  },
  parseHTML() {
    return [{ tag: "div[data-strategy-columns]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-strategy-columns": String(HTMLAttributes.count ?? 2) }), 0];
  },
});

const StrategyAttributes = Extension.create({
  name: "strategyAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => Number(element.getAttribute("data-indent") ?? 0),
            renderHTML: (attributes) => attributes.indent
              ? { "data-indent": String(attributes.indent), style: `margin-left: ${Number(attributes.indent) * 1.5}rem` }
              : {},
          },
        },
      },
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {},
          },
        },
      },
    ];
  },
});

const invisibleSpacingPattern = /[\s\u00a0\u200b\u200c\u200d\u2060\ufeff]/g;
const embeddedContentSelector = [
  "audio",
  "hr",
  "iframe",
  "img",
  "object",
  "svg",
  "table",
  "video",
  "[data-routine-card]",
  "[data-strategy-callout]",
  "[data-strategy-column]",
  "[data-strategy-columns]",
].join(",");

function isEmptyPasteBlock(element: HTMLElement) {
  if (!["DIV", "P"].includes(element.tagName)) return false;
  if (element.closest("td,th,li")) return false;
  if (element.matches(embeddedContentSelector) || element.querySelector(embeddedContentSelector)) return false;
  return (element.textContent ?? "").replace(invisibleSpacingPattern, "") === "";
}

function collapseExcessBreaks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p,div,span").forEach((element) => {
    let consecutiveBreaks = 0;
    for (const node of [...element.childNodes]) {
      if (node instanceof HTMLBRElement) {
        consecutiveBreaks += 1;
        if (consecutiveBreaks > 2) node.remove();
        continue;
      }
      if (node.nodeType === globalThis.Node.TEXT_NODE && !(node.textContent ?? "").replace(invisibleSpacingPattern, "")) {
        continue;
      }
      consecutiveBreaks = 0;
    }
  });
}

export function normalizeStrategyPastedText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const normalized: string[] = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const isBlank = line.replace(invisibleSpacingPattern, "") === "";
    if (isBlank) {
      if (normalized.length > 0 && !previousWasBlank) normalized.push("");
      previousWasBlank = true;
      continue;
    }
    normalized.push(line);
    previousWasBlank = false;
  }

  if (normalized.at(-1) === "") normalized.pop();
  return normalized.join("\n");
}

function cleanOfficeHtml(html: string) {
  if (typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,meta,link,object,iframe").forEach((node) => node.remove());
  collapseExcessBreaks(document.body);
  [...document.body.querySelectorAll<HTMLElement>("p,div")]
    .filter(isEmptyPasteBlock)
    .reverse()
    .forEach((element) => element.remove());
  document.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.startsWith("on") || ["class", "id", "width", "height"].includes(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
    const allowedStyles = ["color", "background-color", "font-weight", "font-style", "text-align", "text-decoration"];
    const style = allowedStyles
      .map((property) => {
        const value = element.style.getPropertyValue(property);
        return value ? `${property}:${value}` : "";
      })
      .filter(Boolean)
      .join(";");
    if (style) element.setAttribute("style", style);
    else element.removeAttribute("style");
  });
  return document.body.innerHTML;
}

export function createStrategyExtensions(options: {
  onPasteFiles: (files: File[]) => void;
  placeholder?: string;
}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    TableKit.configure({ table: { resizable: true } }),
    StrategyImage.configure({
      allowBase64: false,
      HTMLAttributes: { class: "strategy-editor-image" },
    }),
    FileHandler.configure({
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      consumePasteEvent: true,
      onPaste: (_editor, files) => options.onPasteFiles(files),
      onDrop: (_editor, files) => options.onPasteFiles(files),
    }),
    Placeholder.configure({ placeholder: options.placeholder ?? "输入攻略内容，或直接粘贴截图…" }),
    Markdown,
    StrategyAttributes,
    StrategyCallout,
    StrategyColumns,
    StrategyColumn,
    RoutineCardExtension,
    Extension.create({
      name: "officePasteCleaner",
      transformPastedHTML(html) {
        return cleanOfficeHtml(html);
      },
      addKeyboardShortcuts() {
        return {
          Tab: () => this.editor.isActive("table") ? false : this.editor.commands.command(({ tr }) => { tr.insertText("    "); return true; }),
        };
      },
    }),
  ];
}

export function columnsContent(count: 2 | 3) {
  return {
    type: "strategyColumns",
    attrs: { count },
    content: Array.from({ length: count }, () => ({
      type: "strategyColumn",
      content: [{ type: "paragraph" }],
    })),
  };
}
