// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteSaveAction } from "./route-save-action";

const saveAction = vi.fn();
const removeAction = vi.fn();

describe("RouteSaveAction", () => {
  it("renders a save form when the route is not saved", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={false}
        loggedIn={true}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "프로젝트 저장" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("route_1")).toHaveAttribute("name", "routeId");
    expect(screen.getByDisplayValue("/t/topo_1?route=route_1")).toHaveAttribute("name", "returnTo");
  });

  it("renders a remove form when the route is saved", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={true}
        loggedIn={true}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "저장됨" })).toBeInTheDocument();
  });

  it("renders a login prompt label for anonymous users", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={false}
        loggedIn={false}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "로그인 후 저장" })).toBeInTheDocument();
  });
});
