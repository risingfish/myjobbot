import type { Ats } from "../jobs/job.js";
import { fetchAshby } from "./ashby.js";
import { fetchGreenhouse } from "./greenhouse.js";
import { fetchLever } from "./lever.js";
import type { BoardFetcher } from "./types.js";

const FETCHERS: Record<Ats, BoardFetcher> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
};

export function fetcherFor(ats: Ats): BoardFetcher {
  return FETCHERS[ats];
}
