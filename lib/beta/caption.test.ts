import { describe, expect, it } from "vitest";
import { buildInstagramCaption } from "./caption";

describe("buildInstagramCaption", () => {
  it("generates the Phase 5 route caption with boulder and route hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "모락산",
      sectorName: "계원예대",
      boulderName: "큰바위",
      routeName: "Sky Hook",
      grade: "V5",
      boulderHashtags: ["모락산", "슬랩"],
    });

    expect(caption).toContain("[모락산] 계원예대 / 큰바위 / Sky Hook (V5)");
    expect(caption).toContain("@granite.kr #큰바위 #SkyHook #모락산 #슬랩");
  });
});
