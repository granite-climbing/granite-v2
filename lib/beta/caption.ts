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

  return `"${input.routeName}" ${input.grade} on ${input.sectorName}, ${input.boulderName}, ${input.cragName}. @granite.kr ${Array.from(new Set(tags)).join(" ")}`;
}
