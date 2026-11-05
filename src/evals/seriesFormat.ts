import { z } from "zod";
import { RESUME_VIEWS } from "../config/schema.js";

const LABEL = /^[a-z0-9][a-z0-9-]{0,39}$/;
const iso = z.iso.datetime();
const label = z.string().regex(LABEL);

const test = z.strictObject({ label, variant: z.string().min(1).nullable(), model: z.string().min(1).nullable(), view: z.enum(RESUME_VIEWS).optional() });

export const seriesSchema = z.strictObject({
    schema: z.literal(1),
    tags: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)),
    cases: z.array(z.string().min(1)),
    repeats: z.number().int().min(1).max(20),
    tests: z
        .array(test)
        .min(1)
        .max(10)
        .refine((tests) => new Set(tests.map((each) => each.label)).size === tests.length, "labels repeat"),
    createdAt: iso,
});

export const seriesRunSchema = z.strictObject({
    schema: z.literal(1),
    id: z.string().min(1),
    series: z.string().min(1),
    startedAt: iso,
    endedAt: iso.nullable(),
    runs: z.record(z.string(), z.string().nullable()),
});

export type Series = z.infer<typeof seriesSchema>;
export type SeriesRun = z.infer<typeof seriesRunSchema>;
