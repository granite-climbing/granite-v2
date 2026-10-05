import { z } from "zod";

export type RichDescriptionMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "highlight" }
  | { type: "link"; attrs: { href: string } };

export type RichDescriptionInlineNode =
  | { type: "text"; text: string; marks?: RichDescriptionMark[] }
  | { type: "hardBreak" };

export type RichDescriptionParagraph = {
  type: "paragraph";
  content?: RichDescriptionInlineNode[];
};

export type RichDescriptionBlockNode =
  | RichDescriptionParagraph
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichDescriptionInlineNode[] }
  | { type: "bulletList"; content: Array<{ type: "listItem"; content: [RichDescriptionParagraph] }> }
  | { type: "orderedList"; content: Array<{ type: "listItem"; content: [RichDescriptionParagraph] }> }
  | {
      type: "taskList";
      content: Array<{ type: "taskItem"; attrs: { checked: boolean }; content: [RichDescriptionParagraph] }>;
    }
  | { type: "blockquote"; content: RichDescriptionParagraph[] }
  | { type: "horizontalRule" };

export type RichDescriptionDoc = {
  type: "doc";
  content?: RichDescriptionBlockNode[];
};

const emptyAttrs = z.object({}).strict();

const linkMarkSchema = z
  .object({
    type: z.literal("link"),
    attrs: z
      .object({ href: z.string().url().refine((href) => new URL(href).protocol === "https:", "Only HTTPS links are allowed") })
      .strict(),
  })
  .strict();

const markSchema = z.union([
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z.object({ type: z.literal("highlight") }).strict(),
  linkMarkSchema,
]);

const inlineNodeSchema = z.union([
  z
    .object({
      type: z.literal("text"),
      text: z.string().min(1),
      marks: z.array(markSchema).optional(),
    })
    .strict(),
  z.object({ type: z.literal("hardBreak") }).strict(),
]);

const paragraphSchema = z
  .object({
    type: z.literal("paragraph"),
    content: z.array(inlineNodeSchema).optional(),
  })
  .strict();

const listItemSchema = z
  .object({
    type: z.literal("listItem"),
    content: z.tuple([paragraphSchema]),
  })
  .strict();

const taskItemSchema = z
  .object({
    type: z.literal("taskItem"),
    attrs: z.object({ checked: z.boolean() }).strict(),
    content: z.tuple([paragraphSchema]),
  })
  .strict();

const blockNodeSchema = z.union([
  paragraphSchema,
  z
    .object({
      type: z.literal("heading"),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).strict(),
      content: z.array(inlineNodeSchema).optional(),
    })
    .strict(),
  z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1) }).strict(),
  z.object({ type: z.literal("orderedList"), content: z.array(listItemSchema).min(1) }).strict(),
  z.object({ type: z.literal("taskList"), content: z.array(taskItemSchema).min(1) }).strict(),
  z.object({ type: z.literal("blockquote"), content: z.array(paragraphSchema).min(1) }).strict(),
  z.object({ type: z.literal("horizontalRule") }).strict(),
]);

const richDescriptionDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(blockNodeSchema).max(200).optional(),
  })
  .strict();

function countTextChars(node: RichDescriptionDoc | RichDescriptionBlockNode | RichDescriptionParagraph | RichDescriptionInlineNode): number {
  if (node.type === "text") return node.text.length;
  if (node.type === "hardBreak" || node.type === "horizontalRule") return 0;
  if (node.type === "doc" || node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") {
    return (node.content ?? []).reduce((sum, child) => sum + countTextChars(child), 0);
  }
  if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
    return node.content.reduce((sum, item) => sum + countTextChars(item.content[0]), 0);
  }
  return 0;
}

export function parseRichDescription(raw: string): RichDescriptionDoc {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Rich description must be valid JSON");
  }

  const doc = richDescriptionDocSchema.parse(decoded) as RichDescriptionDoc;
  if (countTextChars(doc) > 20_000) {
    throw new Error("Rich description exceeds the 20,000 character limit");
  }
  return doc;
}

function inlineText(nodes: RichDescriptionInlineNode[] | undefined): string {
  return (nodes ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

function blockText(node: RichDescriptionBlockNode): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inlineText(node.content);
    case "bulletList":
      return node.content.map((item) => `- ${blockText(item.content[0])}`).join("\n");
    case "orderedList":
      return node.content.map((item, index) => `${index + 1}. ${blockText(item.content[0])}`).join("\n");
    case "taskList":
      return node.content.map((item) => `- [${item.attrs.checked ? "x" : " "}] ${blockText(item.content[0])}`).join("\n");
    case "blockquote":
      return node.content.map((paragraph) => `> ${blockText(paragraph)}`).join("\n");
    case "horizontalRule":
      return "---";
  }
}

export function toPlainText(doc: RichDescriptionDoc): string {
  return (doc.content ?? []).map(blockText).join("\n\n");
}

export function normalizeRichDescriptionForStorage(raw: string | undefined): { richJson: string | null; plainText: string } {
  if (!raw) return { richJson: null, plainText: "" };
  const doc = parseRichDescription(raw);
  const plainText = toPlainText(doc);
  return {
    richJson: plainText === "" ? null : JSON.stringify(doc),
    plainText,
  };
}

export function legacyTextToRichDescription(text: string): RichDescriptionDoc {
  const content = text
    .split(/\r?\n\r?\n/)
    .filter((paragraph) => paragraph.length > 0)
    .map<RichDescriptionParagraph>((paragraph) => {
      const lines = paragraph.split(/\r?\n/);
      const inline: RichDescriptionInlineNode[] = [];
      lines.forEach((line, index) => {
        if (line.length > 0) inline.push({ type: "text", text: line });
        if (index < lines.length - 1) inline.push({ type: "hardBreak" });
      });
      return inline.length > 0 ? { type: "paragraph", content: inline } : { type: "paragraph" };
    });

  return { type: "doc", content };
}

export const RichDescriptionSchema = richDescriptionDocSchema;
