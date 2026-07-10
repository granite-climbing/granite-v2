// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, refresh: vi.fn() })
}));
vi.mock("@/lib/actions/record", () => ({
  searchRoutesForRecordAction: vi.fn(),
  addRecordAction: vi.fn()
}));

import { RouteMoreActions } from "./route-more-actions";
import type { BetaVideoItem } from "./beta-video-grid";
import { buildRouteRecordSummary } from "@/lib/records/summary";

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
  betaVideos,
  saved: false,
  returnTo: "/t/topo_1?route=route_1",
  saveAction: vi.fn(),
  removeAction: vi.fn(),
  recordRoute: {
    routeId: "route_1",
    routeName: "Little Finger",
    routeGrade: "V5",
    boulderName: "리틀핑거 바위",
    sectorName: "메인섹터",
    cragName: "현충바위",
    boulderHashtags: ["현충바위"]
  },
  recordSummary: buildRouteRecordSummary([]),
  isLoggedIn: true
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
    routerPushMock.mockClear();
  });

  it("opens the add-record dialog prefilled when logged in", () => {
    render(<RouteMoreActions {...baseProps} isLoggedIn={true} />);

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "완등 기록" }));

    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();
    expect(screen.getByText("루트 평가")).toBeInTheDocument();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("sends logged-out users to login with returnTo", () => {
    render(<RouteMoreActions {...baseProps} isLoggedIn={false} />);

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "완등 기록" }));

    expect(screen.queryByRole("dialog", { name: "기록 추가" })).not.toBeInTheDocument();
    expect(routerPushMock).toHaveBeenCalledWith(
      `/login?returnTo=${encodeURIComponent("/t/topo_1?route=route_1")}`
    );
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

  it("marks the bookmark button as not pressed when the route is unsaved", () => {
    render(<RouteMoreActions {...baseProps} saved={false} />);

    openDialog();

    const bookmarkButton = screen.getByRole("button", { name: "북마크" });
    expect(bookmarkButton).toHaveAttribute("aria-pressed", "false");

    const form = bookmarkButton.closest("form") as HTMLFormElement;
    expect(within(form).getByDisplayValue("route_1")).toHaveAttribute("name", "routeId");
    expect(within(form).getByDisplayValue("/t/topo_1?route=route_1")).toHaveAttribute("name", "returnTo");
  });

  it("marks the bookmark button as pressed when the route is already saved", () => {
    render(<RouteMoreActions {...baseProps} saved={true} />);

    openDialog();

    expect(screen.getByRole("button", { name: "북마크" })).toHaveAttribute("aria-pressed", "true");
  });

  it("dispatches the save action when submitting the bookmark form for an unsaved route", async () => {
    const saveAction = vi.fn().mockResolvedValue({ ok: true, message: "" });
    const removeAction = vi.fn().mockResolvedValue({ ok: true, message: "" });
    render(
      <RouteMoreActions {...baseProps} saved={false} saveAction={saveAction} removeAction={removeAction} />
    );

    openDialog();
    const form = screen.getByRole("button", { name: "북마크" }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(saveAction).toHaveBeenCalledTimes(1);
    });
    expect(removeAction).not.toHaveBeenCalled();
    const formData = saveAction.mock.calls[0][0] as FormData;
    expect(formData.get("routeId")).toBe("route_1");
    expect(formData.get("returnTo")).toBe("/t/topo_1?route=route_1");
  });

  it("dispatches the remove action when submitting the bookmark form for a saved route", async () => {
    const saveAction = vi.fn().mockResolvedValue({ ok: true, message: "" });
    const removeAction = vi.fn().mockResolvedValue({ ok: true, message: "" });
    render(
      <RouteMoreActions {...baseProps} saved={true} saveAction={saveAction} removeAction={removeAction} />
    );

    openDialog();
    const form = screen.getByRole("button", { name: "북마크" }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(removeAction).toHaveBeenCalledTimes(1);
    });
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("renders record rating stats and felt distribution from the summary", () => {
    const recordSummary = buildRouteRecordSummary([
      {
        id: "rec_1",
        displayName: "닉네임",
        avatarUrl: null,
        sentAt: "2026-07-01",
        createdAt: "2026-07-01 10:00:00",
        rating: 5,
        feltGradeNum: 4,
        comment: "완등이 어려웠어요ㅜㅜ"
      },
      {
        id: "rec_2",
        displayName: "클라이머",
        avatarUrl: null,
        sentAt: "2026-07-02",
        createdAt: "2026-07-02 10:00:00",
        rating: 4,
        feltGradeNum: 4,
        comment: null
      }
    ]);
    render(<RouteMoreActions {...baseProps} recordSummary={recordSummary} />);

    openDialog();

    expect(screen.getByText("4.5, Solid V4")).toBeInTheDocument();
    expect(screen.getByText("Feels V4")).toBeInTheDocument();
    expect(screen.getByText("Ascents 2")).toBeInTheDocument();
    // felt distribution row: V4 voted twice
    expect(screen.getByText("완등이 어려웠어요ㅜㅜ")).toBeInTheDocument();
    expect(screen.getByText("닉네임")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기록하기" })).toBeInTheDocument();
  });

  it("shows empty states when the route has no records", () => {
    render(<RouteMoreActions {...baseProps} />);

    openDialog();

    expect(screen.getByText("아직 평가되지 않았어요!")).toBeInTheDocument();
    expect(
      screen.getByText("아직 완등자가 없어요. 최초의 완등자가 되어보세요!")
    ).toBeInTheDocument();
  });

  it("shows the comment empty state when ascents exist without comments", () => {
    const recordSummary = buildRouteRecordSummary([
      {
        id: "rec_1",
        displayName: "닉네임",
        avatarUrl: null,
        sentAt: "2026-07-01",
        createdAt: "2026-07-01 10:00:00",
        rating: 4,
        feltGradeNum: null,
        comment: null
      }
    ]);
    render(<RouteMoreActions {...baseProps} recordSummary={recordSummary} />);

    openDialog();

    expect(screen.getByText("아직 작성된 한줄평이 없어요.")).toBeInTheDocument();
  });

  it("opens the add-record dialog from the 기록하기 comment button", () => {
    render(<RouteMoreActions {...baseProps} isLoggedIn={true} />);

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "기록하기" }));

    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();
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
