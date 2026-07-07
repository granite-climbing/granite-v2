// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordsTabs, resolveRecordsTab } from "./records-tabs";

describe("RecordsTabs", () => {
  it("marks the active tab and links both tabs", () => {
    render(<RecordsTabs active="record" />);

    const recordTab = screen.getByRole("link", { name: "나의 기록" });
    const videoTab = screen.getByRole("link", { name: "나의 영상" });

    expect(recordTab).toHaveAttribute("aria-current", "page");
    expect(recordTab).toHaveAttribute("href", "/me/records?tab=record");
    expect(videoTab).not.toHaveAttribute("aria-current");
    expect(videoTab).toHaveAttribute("href", "/me/records?tab=video");
  });
});

describe("resolveRecordsTab", () => {
  it("defaults to the video tab", () => {
    expect(resolveRecordsTab(undefined)).toBe("video");
    expect(resolveRecordsTab("unknown")).toBe("video");
    expect(resolveRecordsTab("record")).toBe("record");
  });
});
