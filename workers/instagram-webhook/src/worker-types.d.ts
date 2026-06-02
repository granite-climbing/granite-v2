// Minimal Cloudflare Workers runtime type shims for typecheck only.
// The real Worker runtime provides these globally.

declare global {
  interface D1Result<T = unknown> {
    success: boolean;
    results: T[];
    meta: { changes?: number; last_row_id?: number; duration?: number };
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface R2Object {
    key: string;
    size: number;
    httpEtag: string;
  }

  interface R2PutOptions {
    httpMetadata?: { contentType?: string };
  }

  interface R2Bucket {
    put(
      key: string,
      value: ArrayBuffer | ReadableStream | string | null,
      options?: R2PutOptions
    ): Promise<R2Object | null>;
    get(key: string): Promise<R2Object | null>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export {};
