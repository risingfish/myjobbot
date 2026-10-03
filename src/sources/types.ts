import type { JsonGetter } from "../http/client.js";
import type { Job } from "../jobs/job.js";

interface BoardRef {
  name: string;
  slug: string;
}

export type BoardFetcher = (board: BoardRef, http: JsonGetter) => Promise<Job[]>;
