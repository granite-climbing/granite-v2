function hashtag(value: string): string {
  return `#${value.replace(/\s+/g, "")}`;
}

export type CaptionRouteContext = {
  cragName: string;
  sectorName: string;
  boulderName: string;
  routeName: string;
  grade: string;
  boulderHashtags: string[];
};

export function buildInstagramCaption(input: CaptionRouteContext): string {
  const tags = [
    hashtag(input.boulderName),
    hashtag(input.routeName),
    ...input.boulderHashtags.map(hashtag),
  ];

  return [
    "방금 보냈어요!",
    `[${input.cragName}] ${input.sectorName} / ${input.boulderName} / ${input.routeName} (${input.grade})`,
    "",
    `@granite.kr ${Array.from(new Set(tags)).join(" ")}`,
  ].join("\n");
}
