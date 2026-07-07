// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordVideoGrid } from "./record-video-grid";

describe("RecordVideoGrid", () => {
  it("renders a tile per video", () => {
    render(
      <RecordVideoGrid
        videos={[
          { id: "v1", thumbnailUrl: "https://cdn.granite.kr/betas/v1/thumb.jpg", title: "New Line" },
          { id: "v2", thumbnailUrl: null, title: "Memorial Boulder" }
        ]}
      />
    );

    const grid = screen.getByRole("list", { name: "나의 영상" });
    expect(grid.children).toHaveLength(2);
    expect(screen.getByAltText("New Line")).toHaveAttribute("src", "https://cdn.granite.kr/betas/v1/thumb.jpg");
    expect(screen.getByText("Memorial Boulder")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<RecordVideoGrid videos={[]} />);

    expect(screen.getByText("아직 등록된 영상이 없습니다.")).toBeInTheDocument();
  });
});
