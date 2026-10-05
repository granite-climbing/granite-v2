import { describe, expect, it } from "vitest";
import {
  legacyTextToRichDescription,
  normalizeRichDescriptionForStorage,
  parseRichDescription,
  toPlainText,
} from "./rich-description";

const richJson = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "접근 🪨" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }, { type: "highlight" }], text: "주차 후" },
        { type: "hardBreak" },
        { type: "text", marks: [{ type: "underline" }], text: "10분 이동" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "물" }] }] },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "쓰레기 되가져가기" }] }],
        },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "낙석 주의" }] }] },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "italic" }, { type: "link", attrs: { href: "https://granite.kr/terms/" } }], text: "이용약관" },
      ],
    },
  ],
});

describe("rich description", () => {
  it("parses the supported document and derives readable plain text", () => {
    const doc = parseRichDescription(richJson);

    expect(doc.type).toBe("doc");
    expect(toPlainText(doc)).toBe(
      "접근 🪨\n\n주차 후\n10분 이동\n\n- 물\n\n- [x] 쓰레기 되가져가기\n\n> 낙석 주의\n\n---\n\n이용약관",
    );
  });

  it.each([
    '{"type":"doc","content":[{"type":"image"}]}',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1}}]}',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}],"text":"x"}]}]}',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"highlight","attrs":{"color":"#fff"}}],"text":"x"}]}]}',
    '{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"bulletList","content":[]}]}]}]}',
  ])("rejects unsupported or unsafe JSON: %s", (raw) => {
    expect(() => parseRichDescription(raw)).toThrow();
  });

  it("normalizes an empty document to null storage values", () => {
    expect(normalizeRichDescriptionForStorage(JSON.stringify({ type: "doc", content: [] }))).toEqual({
      richJson: null,
      plainText: "",
    });
  });

  it("converts legacy text to paragraphs and hard breaks", () => {
    expect(legacyTextToRichDescription("첫 줄\n둘째 줄\n\n새 문단")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "첫 줄" }, { type: "hardBreak" }, { type: "text", text: "둘째 줄" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "새 문단" }] },
      ],
    });
  });
});
