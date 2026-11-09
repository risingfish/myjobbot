import type { z } from "zod";
import type { JsonGetter, JsonPoster } from "../http/client.js";
import type { DescriptionFormat, Job } from "../jobs/job.js";

export type SourceHttp = JsonGetter & JsonPoster;

export type Cursor = Record<string, unknown>;

export interface SourceContext<A = unknown> {
    http: SourceHttp;
    sourceName: string;
    access?: A;
    preview?: boolean;
}

export interface BoardLink {
    kind: string;
    board: string;
    slug: string;
    postingId: string | null;
    host?: string;
    site?: string;
}

export interface SourcePage {
    jobs: Job[];
    cost: number;
    next: Cursor | null;
}

export interface SourceField {
    name: string;
    label: string;
    input: "text" | "select" | "checkbox";
    options?: readonly string[];
    optional?: boolean;
    placeholder?: string;
}

interface CompanyHint {
    name: string;
    careersPage: string;
}

export type Requirement = "jsearch_key" | "gmail";

export type Met = Record<Requirement, boolean>;

export const OFF_WHILE_UNMET: Record<Requirement, boolean> = { gmail: true, jsearch_key: false };

interface SourceLimits {
    maxJobsPerRun: number | null;
    refresh: "every_run" | "jsearch_refresh_hours";
    spends: "jsearch" | null;
    skipWhenBudgetUsed: boolean;
}

export interface BoardPosting {
    title: string;
    location: string | null;
    url: string;
    postingId: string;
    description: string | null;
    format: DescriptionFormat;
}

interface BoardPostings<P> {
    list?(params: P, http: SourceHttp): Promise<BoardPosting[]>;
    search?(params: P, text: string, http: SourceHttp): Promise<BoardPosting[]>;
    one?(params: P, postingId: string, http: SourceHttp): Promise<BoardPosting>;
}

export interface SourceModule<P, A = unknown> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly kind: "ats" | "api" | "email" | "web";
    readonly jobAts?: string;
    readonly descriptions: "included" | "careers_lookup";
    readonly scope: "company" | "query" | "account";
    readonly params: z.ZodType<P>;
    readonly fields: readonly SourceField[];
    readonly requires: readonly Requirement[];
    readonly limits: SourceLimits;
    fromUrl?(url: URL): P | null;
    boardLink?(url: URL): BoardLink | null;
    suggestName?(params: P): string;
    target(params: P): string;
    fetch(params: P, ctx: SourceContext<A>, from: Cursor | null): AsyncIterable<SourcePage>;
    company?(params: P, name: string): CompanyHint;
    readonly postings?: BoardPostings<P>;
}
