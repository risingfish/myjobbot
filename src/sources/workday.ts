import { z } from "zod";
import type { JsonGetter, JsonPoster } from "../http/client.js";
import { optionalText } from "./fields.js";
import { escapedHtmlToText } from "./htmlText.js";

interface WorkdayBoard {
    host: string;
    slug: string;
    site: string;
}

export interface WorkdayListing {
    title: string;
    location: string | null;
    url: string;
    postingId: string;
}

const SEARCH_LIMIT = 20;
const JOB_PATH = /^\/job\/[^?#]+$/;

const searchAnswer = z.object({ jobPostings: z.array(z.object({ title: z.string(), externalPath: z.string().regex(JOB_PATH), locationsText: optionalText })) });
const postingAnswer = z.object({ jobPostingInfo: z.object({ title: z.string(), jobDescription: optionalText, location: optionalText }) });

/** Searches a Workday board for a title with Workday's own search, listing up to 20 postings with their addresses. */
export async function searchWorkday(http: JsonPoster, board: WorkdayBoard, text: string): Promise<WorkdayListing[]> {
    const answer = searchAnswer.parse(await http.postJson(`${dataBase(board)}/jobs`, { appliedFacets: {}, limit: SEARCH_LIMIT, offset: 0, searchText: text }));
    return answer.jobPostings.map((posting) => ({ title: posting.title, location: posting.locationsText, url: pageUrl(board, posting.externalPath), postingId: posting.externalPath }));
}

/** Reads one Workday posting from its job path, with its description as plain text. */
export async function workdayPosting(http: JsonGetter, board: WorkdayBoard, path: string): Promise<Omit<WorkdayListing, "postingId"> & { description: string }> {
    if (!JOB_PATH.test(path) || path.includes("/../")) throw new Error(`${path} is not a Workday job path`);
    const { jobPostingInfo: info } = postingAnswer.parse(await http.getJson(`${dataBase(board)}${path}`));
    return { title: info.title, location: info.location, url: pageUrl(board, path), description: escapedHtmlToText(info.jobDescription ?? "") };
}

/** Builds the address of a board's public data. */
function dataBase(board: WorkdayBoard): string {
    return `https://${board.host}/wday/cxs/${encodeURIComponent(board.slug)}/${encodeURIComponent(board.site)}`;
}

/** Builds the address a person would open for a posting. */
function pageUrl(board: WorkdayBoard, path: string): string {
    return `https://${board.host}/${encodeURIComponent(board.site)}${path}`;
}
