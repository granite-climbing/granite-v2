// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

import { EditDrawer } from "./edit-drawer";

describe("EditDrawer", () => {
  it("stacks above the admin header", () => {
    render(
      <EditDrawer closeHref="/admin/content/areas" title="Area 편집">
        <p>Drawer content</p>
      </EditDrawer>
    );

    const drawer = screen.getByLabelText("Close drawer").parentElement;

    expect(drawer).toHaveClass("fixed", "inset-0", "z-[60]");
  });
});
