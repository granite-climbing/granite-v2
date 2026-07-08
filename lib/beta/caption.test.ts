import { describe, expect, it } from "vitest";
import { buildInstagramCaption } from "./caption";

describe("buildInstagramCaption", () => {
  it("builds the Figma-format caption with mention and hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "안양예술공원",
      sectorName: "허니1",
      boulderName: "허니 볼더",
      routeName: "Honey No.6",
      grade: "V6",
      boulderHashtags: ["안양_허니넘버6"],
    });

    expect(caption).toBe(
      '"Honey No.6" V6 on 허니1, 허니 볼더, 안양예술공원. @granite.kr #허니볼더 #HoneyNo.6 #안양_허니넘버6'
    );
  });

  it("dedupes hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "크랙",
      sectorName: "섹터",
      boulderName: "볼더",
      routeName: "볼더",
      grade: "V1",
      boulderHashtags: ["볼더"],
    });

    expect(caption.match(/#볼더/g)).toHaveLength(1);
  });
});
