import type { FileConfig } from "../config/schema.js";

type Board = Pick<FileConfig["companies"][number], "ats" | "slug">;

const BOARD_ORIGINS: Record<Board["ats"], string> = {
    greenhouse: "https://job-boards.greenhouse.io",
    lever: "https://jobs.lever.co",
    ashby: "https://jobs.ashbyhq.com",
};

/** Gives the public address of a configured company's job board, which serves as its careers page. */
export function boardPageUrl(board: Board): string {
    return `${BOARD_ORIGINS[board.ats]}/${encodeURIComponent(board.slug)}`;
}
