import type { z } from "zod";
import type { Job } from "../jobs/job.js";
import type { BoardFetcher } from "./types.js";

interface BoardDef<T> {
  url: (slug: string) => string;
  postings: z.ZodType<T[]>;
  toJob: (company: string, post: T) => Job;
  keep?: (post: T) => boolean;
}

export function defineBoard<T>(def: BoardDef<T>): BoardFetcher {
  return async (ref, http) => {
    const posts = def.postings.parse(await http.getJson(def.url(ref.slug)));
    return posts.filter(def.keep ?? (() => true)).map((post) => def.toJob(ref.name, post));
  };
}
