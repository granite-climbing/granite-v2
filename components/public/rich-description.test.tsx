import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichDescription } from "./rich-description";

const richJson = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "접근 🪨" }] },
    { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "주차 후" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "물" }] }] }] },
    { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "쓰레기" }] }] }] },
    { type: "paragraph", content: [{ type: "text", marks: [{ type: "link", attrs: { href: "https://granite.kr/terms/" } }], text: "이용약관" }] },
  ],
});

describe("RichDescription", () => {
  it("renders validated rich JSON with semantic formatting and safe links", () => {
    const html = renderToStaticMarkup(<RichDescription richJson={richJson} fallbackText="fallback" />);
    expect(html).toContain("<h2>접근 🪨</h2>");
    expect(html).toContain("<strong>주차 후</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain('href="https://granite.kr/terms/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
  });

  it("falls back to plain text for invalid stored JSON", () => {
    expect(renderToStaticMarkup(<RichDescription richJson='{"type":"doc","content":[{"type":"image"}]}' fallbackText="legacy" />)).toContain("legacy");
  });
});
