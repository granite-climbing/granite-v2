// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteMoreActions } from "./route-more-actions";
import type { BetaVideoItem } from "./beta-video-grid";

const betaVideos: BetaVideoItem[] = [
  {
    id: "beta_1",
    mediaUrl: "https://www.instagram.com/reel/example/",
    thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
    displayName: "granite_user"
  }
];

const baseProps = {
  route: {
    id: "route_1",
    name: "Little Finger",
    grade: "V5",
    fa: "@someone",
    description: "왼손 언더와 오른손 크림프를 이용해 오른다."
  },
  breadcrumb: {
    areaName: "서울",
    cragName: "현충바위",
    sectorName: "메인섹터",
    boulderName: "리틀핑거 바위"
  },
  caption: "[현충바위] 메인섹터 / 리틀핑거 바위 / Little Finger (V5)\n@granite.kr #리틀핑거바위 #LittleFinger",
  betaVideos
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "More" }));
}

function openBetaSheet() {
  fireEvent.click(screen.getByRole("button", { name: "beta" }));
}

describe("RouteMoreActions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens route details from the More button", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();
    expect(screen.getByText("서울 > 현충바위 > 메인섹터 >")).toBeInTheDocument();
    expect(screen.getByText("리틀핑거 바위")).toBeInTheDocument();
    const nameRow = screen.getByText("Little Finger").parentElement as HTMLElement;
    expect(within(nameRow).getByText("V5")).toBeInTheDocument();
    expect(screen.getByText("FA @someone")).toBeInTheDocument();
    expect(screen.getByText("왼손 언더와 오른손 크림프를 이용해 오른다.")).toBeInTheDocument();
  });

  it("omits the FA and description lines when empty", () => {
    render(
      <RouteMoreActions
        {...baseProps}
        route={{ ...baseProps.route, fa: "", description: "" }}
      />
    );

    openDialog();

    expect(screen.queryByText(/^FA /)).not.toBeInTheDocument();
    expect(screen.queryByText("왼손 언더와 오른손 크림프를 이용해 오른다.")).not.toBeInTheDocument();
  });

  it("renders the header action icon buttons", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByRole("button", { name: "북마크" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완등 기록" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공유하기" })).toBeInTheDocument();
  });

  it("renders mock rating stats", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByText("4.5, Solid V4")).toBeInTheDocument();
    expect(screen.getByText("Feels V4.1")).toBeInTheDocument();
    expect(screen.getByText("Ascents 1,027")).toBeInTheDocument();
  });

  it("renders mock comments", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByText("Ascents comment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기록하기" })).toBeInTheDocument();
    expect(screen.getAllByText("완등이 어려웠어요ㅜㅜ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7months ago").length).toBeGreaterThan(0);
  });

  it("closes the sheet with the back arrow", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("marks the More trigger with dialog popup semantics that reflect open state", () => {
    render(<RouteMoreActions {...baseProps} />);

    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the beta video sheet from the beta pill", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    openBetaSheet();

    expect(screen.getByText("베타 동영상")).toBeInTheDocument();
    expect(screen.getByLabelText("granite_user 베타 영상 열기")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === baseProps.caption)
    ).toBeInTheDocument();
  });

  it("opens the manual beta form from the beta video sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    openBetaSheet();
    fireEvent.click(screen.getByRole("button", { name: "베타 영상 올리기" }));

    expect(screen.getByText("영상 URL")).toBeInTheDocument();
  });

  it("dismisses only the topmost layer on Escape", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    openBetaSheet();
    expect(screen.getByText("베타 동영상")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("베타 동영상")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("dismisses only the manual form on Escape when it is open inside the beta sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    openBetaSheet();
    fireEvent.click(screen.getByRole("button", { name: "베타 영상 올리기" }));
    expect(screen.getByText("영상 URL")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("영상 URL")).not.toBeInTheDocument();
    expect(screen.getByText("베타 동영상")).toBeInTheDocument();
  });

  it("moves focus to the back arrow when the sheet opens", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  });

  it("still opens Instagram when the clipboard write fails", () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(<RouteMoreActions {...baseProps} />);

    openDialog();
    openBetaSheet();
    fireEvent.click(screen.getByRole("button", { name: "캡션 복사하고 Instagram 열기" }));

    return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(writeText).toHaveBeenCalledWith(baseProps.caption);
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining("https://www.instagram.com/?caption="),
        "_blank",
        "noopener,noreferrer"
      );
    });
  });
});
