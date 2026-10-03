import type { FileConfig } from "../config/schema.js";

const MS_PER_SECOND = 1000;

export interface JsonGetter {
  getJson(url: string): Promise<unknown>;
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export class HttpClient implements JsonGetter {
  constructor(
    private readonly config: FileConfig["http"],
    private readonly fetchFn: FetchFn,
  ) {}

  async getJson(url: string): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.timeout_s * MS_PER_SECOND);
    const response = await this.fetchFn(url, { signal });
    if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    return response.json();
  }
}
