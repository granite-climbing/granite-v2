import { describe, expect, it } from "vitest";
import {
  htmlClipboardToSafeHtml,
  markdownToSafeHtml,
  plainTextFromRichText,
} from "./crag-description";

describe("markdownToSafeHtml", () => {
  it("converts the supplied crag notice into paragraphs, strong text, and a list", () => {
    const html = markdownToSafeHtml(`무등산은 **국립공원으로 지정된 지역**입니다.\n\n- 📝 **등반 전 입산 허가 신청을 완료해주세요.**\n- 🔥 화기 사용 금지`);

    expect(html).toContain("<strong>국립공원으로 지정된 지역</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>📝 <strong>등반 전 입산 허가 신청을 완료해주세요.</strong></li>");
  });

  it("supports rich block and inline Markdown syntax", () => {
    const html = markdownToSafeHtml(`# 제목\n\n> 인용\n\n- [x] 완료\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n*기울임* **굵게** ~~취소~~ ==강조== ++밑줄++ [링크](https://granite.kr) \`코드\``);

    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain("<table>");
    expect(html).toContain("<em>기울임</em>");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<s>취소</s>");
    expect(html).toContain("<mark>강조</mark>");
    expect(html).toContain("<u>밑줄</u>");
    expect(html).toContain('<a href="https://granite.kr">링크</a>');
    expect(html).toContain("<code>코드</code>");
  });

  it("removes executable and media HTML from Markdown", () => {
    const html = markdownToSafeHtml(`<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(2)">링크</a><iframe src="https://bad.example"></iframe><img src="https://bad.example/a.png">`);

    expect(html).not.toMatch(/script|onclick|javascript:|iframe|<img/i);
    expect(html).toContain("링크");
  });
});

describe("htmlClipboardToSafeHtml", () => {
  it("keeps semantic rich text tags but strips styling and unsafe attributes", () => {
    const html = htmlClipboardToSafeHtml(`<p style="color:red"><strong>굵게</strong> <em>기울임</em> <s>취소</s> <u>밑줄</u> <mark>강조</mark> <a href="mailto:hello@granite.kr" onclick="bad()">메일</a></p>`);

    expect(html).toBe("<p><strong>굵게</strong> <em>기울임</em> <s>취소</s> <u>밑줄</u> <mark>강조</mark> <a href=\"mailto:hello@granite.kr\">메일</a></p>");
  });
});

describe("plainTextFromRichText", () => {
  it("creates a safe one-line preview from rich HTML", () => {
    expect(plainTextFromRichText("<p>첫 문단</p><ul><li><strong>둘째</strong></li></ul>")).toBe("첫 문단 둘째");
  });
});
