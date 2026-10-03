import type { Ats } from "../jobs/job.js";
import { fetchGreenhouse } from "./greenhouse.js";
import type { BoardFetcher } from "./types.js";

const notYetSupported: BoardFetcher = async (board) => {
  throw new Error(`${board.name}: this board type is not supported yet`);
};

const FETCHERS: Record<Ats, BoardFetcher> = {
  greenhouse: fetchGreenhouse,
  lever: notYetSupported,
  ashby: notYetSupported,
};

export function fetcherFor(ats: Ats): BoardFetcher {
  return FETCHERS[ats];
}
