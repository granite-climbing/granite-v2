import { z } from "zod";

const w3wResponseSchema = z.object({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

const w3wErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
  }),
});

export class What3WordsConfigError extends Error {
  constructor() {
    super("what3words API key is not configured.");
    this.name = "What3WordsConfigError";
  }
}

export class What3WordsInvalidAddressError extends Error {
  constructor() {
    super("Invalid what3words address.");
    this.name = "What3WordsInvalidAddressError";
  }
}

export class What3WordsRequestError extends Error {
  constructor() {
    super("Could not convert this what3words address.");
    this.name = "What3WordsRequestError";
  }
}

export type Coordinates = {
  lat: number;
  lng: number;
};

export function normalizeW3wAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("///") ? trimmed.slice(3) : trimmed;
}

export async function convertW3wToCoordinates(
  words: string,
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<Coordinates> {
  const apiKey = options.apiKey ?? process.env.W3W_API_KEY ?? "";
  if (apiKey.trim() === "") {
    throw new What3WordsConfigError();
  }

  const normalizedWords = normalizeW3wAddress(words);
  const url = new URL("https://api.what3words.com/v3/convert-to-coordinates");
  url.searchParams.set("words", normalizedWords);
  url.searchParams.set("format", "json");

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
    },
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = w3wErrorSchema.safeParse(json);
    if (parsedError.success && parsedError.data.error.code === "BadWords") {
      throw new What3WordsInvalidAddressError();
    }
    throw new What3WordsRequestError();
  }

  const parsed = w3wResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new What3WordsRequestError();
  }

  return parsed.data.coordinates;
}
