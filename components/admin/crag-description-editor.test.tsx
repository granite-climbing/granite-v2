// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CragDescriptionEditor } from "./crag-description-editor";

describe("CragDescriptionEditor", () => {
  it("converts pasted Markdown to rich JSON submitted by the form", async () => {
    render(<CragDescriptionEditor initialRichJson={null} initialText="" />);

    const editor = await screen.findByRole("textbox");
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => type === "text/plain" ? "**굵게**\n\n- 목록" : "",
      },
    });

    await waitFor(() => {
      const submitted = screen.getByDisplayValue(/bold/) as HTMLInputElement;
      expect(submitted).toHaveAttribute("name", "descriptionRichJson");
      expect(JSON.parse(submitted.value)).toEqual(expect.objectContaining({
        content: expect.arrayContaining([expect.objectContaining({ type: "bulletList" })]),
      }));
    });
  });

  it("converts semantic HTML clipboard input while excluding executable markup", async () => {
    render(<CragDescriptionEditor initialRichJson={null} initialText="" />);

    const editor = await screen.findByRole("textbox");
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => type === "text/html"
          ? '<p><mark>강조</mark><script>alert(1)</script><a href="javascript:bad()">링크</a></p>'
          : "",
      },
    });

    await waitFor(() => {
      const submitted = screen.getByDisplayValue(/highlight/);
      expect(submitted).not.toHaveValue(expect.stringMatching(/script|javascript:/));
    });
  });
});
