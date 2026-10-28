import { z } from "zod";
import type { Job } from "../../jobs/job.js";
import { parseBoardLink } from "../boardLink.js";
import type { SourceContext, SourceModule, SourcePage } from "../module.js";

type SlugBoardId = "greenhouse" | "lever" | "ashby";

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
}

const params = z.object({ slug: z.string().min(1) });

/** Builds the source module for a job board that publishes a company's whole board at one address named by its board id. */
export function slugBoard<T>(def: SlugBoardDef<T>): SourceModule<BoardParams> {
    return {
        id: def.id,
        name: def.name,
        description: def.description,
        kind: "ats",
        scope: "company",
        params,
        fields: [{ name: "slug", label: "Board id", input: "text" }],
        requires: [],
        limits: { maxJobsPerRun: null, refresh: "every_run" },
        fromUrl: (url) => boardParams(def.id, url),
        suggestName: ({ slug }) => slug.charAt(0).toUpperCase() + slug.slice(1),
        target: ({ slug }) => `${def.id}:${slug.toLowerCase()}`,
        company: ({ slug }, name) => ({ name, careersPage: `${def.origin}/${encodeURIComponent(slug)}` }),
        fetch: (board, ctx) => boardPages(def, board, ctx),
    };
}

/** Gives the board id a pasted link names when it is a link to this board's platform, or null otherwise. */
function boardParams(id: SlugBoardId, url: URL): BoardParams | null {
    const link = parseBoardLink(url.href);
    return link?.kind === id ? { slug: link.slug } : null;
}

/** Downloads a company's postings, validates them, and yields them as one page of jobs. */
async function* boardPages<T>(def: SlugBoardDef<T>, board: BoardParams, ctx: SourceContext): AsyncGenerator<SourcePage> {
    const posts = def.postings.parse(await ctx.http.getJson(def.url(board.slug)));
    yield { jobs: posts.filter(def.keep ?? (() => true)).map((post) => def.toJob(ctx.sourceName, post)), cost: 0, next: null };
}
