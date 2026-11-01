import type { z } from "zod";
import type { Settings } from "../config/schema.js";
import type { AlertDeps, AlertRead } from "../gmail/alertFetch.js";
import type { JsonGetter, JsonPoster } from "../http/client.js";
import type { DescriptionFormat, Job } from "../jobs/job.js";

export type SourceHttp = JsonGetter & JsonPoster;

export type Cursor = Record<string, unknown>;

interface JsearchAccess {
    apiKey: string;
    settings: Settings["jsearch"];
}

export interface SourceContext {
    http: SourceHttp;
    sourceName: string;
    jsearch?: JsearchAccess;
    alerts?: AlertDeps;
    preview?: boolean;
}

export interface SourcePage {
    jobs: Job[];
    cost: number;
    next: Cursor | null;
    alerts?: AlertRead;
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

interface SourceLimits {
    maxJobsPerRun: number | null;
    refresh: "every_run" | "jsearch_refresh_hours";
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

export interface SourceModule<P> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly kind: "ats" | "api" | "email" | "web";
    readonly scope: "company" | "query" | "account";
    readonly params: z.ZodType<P>;
    readonly fields: readonly SourceField[];
    readonly requires: readonly Requirement[];
    readonly limits: SourceLimits;
    fromUrl?(url: URL): P | null;
    suggestName?(params: P): string;
    target(params: P): string;
    fetch(params: P, ctx: SourceContext, from: Cursor | null): AsyncIterable<SourcePage>;
    company?(params: P, name: string): CompanyHint;
    readonly postings?: BoardPostings<P>;
}
