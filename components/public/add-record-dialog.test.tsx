// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchActionMock = vi.hoisted(() => vi.fn());
const addActionMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/record", () => ({
  searchRoutesForRecordAction: searchActionMock,
  addRecordAction: addActionMock
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() })
}));

import { AddRecordDialog } from "./add-record-dialog";

const honeyRoute = {
  routeId: "route_1",
  routeName: "Honey No.6",
  routeGrade: "V6",
  boulderName: "허니 볼더",
  sectorName: "허니1",
  cragName: "안양예술공원",
  boulderHashtags: ["안양_허니넘버6"]
};

describe("AddRecordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders the search-first state without optional sections", () => {
    render(<AddRecordDialog onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("문제 이름을 검색해주세요")).toBeInTheDocument();
    expect(screen.queryByText("루트 평가")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Youtube 혹은 Instagram 링크")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeDisabled();
  });

  it("searches and selects a route, revealing rating/media sections", async () => {
    searchActionMock.mockResolvedValue([honeyRoute]);
    render(<AddRecordDialog onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("문제 이름을 검색해주세요"), {
      target: { value: "honey" }
    });

    const option = await screen.findByRole("button", { name: /Honey No\.6/ }, { timeout: 2000 });
    fireEvent.click(option);

    expect(screen.getByText("루트 평가")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Youtube 혹은 Instagram 링크")).toBeInTheDocument();
    expect(
      screen.getByText(/"Honey No\.6" V6 on 허니1, 허니 볼더, 안양예술공원/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeEnabled();
  });

  it("starts prefilled from a route entry point", () => {
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={() => {}} />);

    expect(screen.getByText("루트 평가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeEnabled();
  });

  it("submits and closes on success", async () => {
    addActionMock.mockResolvedValue({ ok: true, message: "기록이 추가되었습니다." });
    const onClose = vi.fn();
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "별점 4점" }));
    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    await waitFor(() => expect(addActionMock).toHaveBeenCalled());
    const formData = addActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("routeId")).toBe("route_1");
    expect(formData.get("rating")).toBe("4");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows the failure message and stays open", async () => {
    addActionMock.mockResolvedValue({ ok: false, message: "이미 등록된 영상입니다." });
    const onClose = vi.fn();
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    expect(await screen.findByText("이미 등록된 영상입니다.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
