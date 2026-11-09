import { z } from "zod";
import type { Job } from "../../jobs/job.js";
import { linkParts } from "../linkParts.js";
import type { BoardLink, BoardPosting, SourceContext, SourceHttp, SourceModule, SourcePage } from "../module.js";

type SlugBoardId = "greenhouse" | "lever" | "ashby" | "gem";

interface BoardParams {
    slug: string;
}

interface SlugBoardDef<T> {
    id: SlugBoardId;
    name: string;
    description: string;
    origin: string;
    url: (slug: string) => string;
    postings: z.ZodType<T[]>;
    toJob: (company: string, post: T) => Job;
    keep?: (post: T) => boolean;
    link: (url: URL, parts: string[]) => PostingLink | null;
}

interface PostingLink {
    slug: string;
    postingId: string | null;
}

const params = z.object({ slug: z.string().min(1) });

const SLUG_BOARD = {
    kind: "ats",
    descriptions: "included",
    scope: "company",
    params,
    fields: [{ name: "slug", label: "Board id", input: "text" }],
    requires: [],
    limits: { maxJobsPerRun: null, refresh: "every_run", spends: null, skipWhenBudgetUsed: false },
} as const satisfies Partial<SourceModule<BoardParams>>;

/** Builds the source module for a job board that publishes a company's whole board at one address named by its board id. */
export function slugBoard<T>(def: SlugBoardDef<T>): SourceModule<BoardParams> {
    return {
        id: def.id,
        name: def.name,
        description: def.description,
        ...SLUG_BOARD,
        fromUrl: (url) => boardParams(def, url),
        boardLink: (url) => boardLinkOf(def, url),
        suggestName: ({ slug }) => slug.charAt(0).toUpperCase() + slug.slice(1),
        target: ({ slug }) => `${def.id}:${slug.toLowerCase()}`,
        company: ({ slug }, name) => ({ name, careersPage: `${def.origin}/${encodeURIComponent(slug)}` }),
        fetch: (board, ctx) => boardPages(def, board, ctx),
        postings: { list: (board, http) => boardPostings(def, board, http) },
    };
}

/** Gives the board id a pasted link names when it is a link to this board's platform, or null otherwise. */
function boardParams<T>(def: SlugBoardDef<T>, url: URL): BoardParams | null {
    const link = boardLinkOf(def, url);
    return link === null ? null : { slug: link.slug };
}

/** Reads a link to this board's platform, naming the board and any posting, or gives null for any other link. */
function boardLinkOf<T>(def: SlugBoardDef<T>, url: URL): BoardLink | null {
    const parts = linkParts(url);
    const found = parts === null ? null : def.link(url, parts);
    return found === null ? null : { kind: def.id, board: `${def.id}:${found.slug}`, ...found };
}

/** Reads a board address shaped /<slug>[/<posting>]. */
export function slugAndPosting(parts: string[]): PostingLink | null {
    const [slug, postingId = null] = parts;
    if (slug === undefined || parts.length > 2) return null;
    return { slug, postingId };
}

/** Yields a company's whole board as one page of jobs. */
async function* boardPages<T>(def: SlugBoardDef<T>, board: BoardParams, ctx: SourceContext): AsyncGenerator<SourcePage> {
    yield { jobs: await boardJobs(def, board, ctx), cost: 0, next: null };
}

/** Lists every posting on a board for the careers lookup, with its description. */
async function boardPostings<T>(def: SlugBoardDef<T>, board: BoardParams, http: SourceHttp): Promise<BoardPosting[]> {
    const jobs = await boardJobs(def, board, { http, sourceName: board.slug });
    return jobs.map((job) => ({ title: job.title, location: job.location, url: job.url, postingId: job.jobId, description: job.description, format: job.descriptionFormat }));
}

/** Downloads a company's postings, validates them, and maps each listed one into a Job. */
async function boardJobs<T>(def: SlugBoardDef<T>, board: BoardParams, ctx: SourceContext): Promise<Job[]> {
    const posts = def.postings.parse(await ctx.http.getJson(def.url(board.slug)));
    return posts.filter(def.keep ?? (() => true)).map((post) => def.toJob(ctx.sourceName, post));
}
