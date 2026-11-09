import type { EvalFiles } from "./files.js";
import type { Context } from "./report.js";

export type ContextFiles = Pick<EvalFiles, "cases" | "answerKeys" | "profiles">;

/** Reads the cases, answer keys and profiles a report judges against. */
export async function contextOf(files: ContextFiles): Promise<Context> {
    const [cases, keys, profiles] = await Promise.all([files.cases(), files.answerKeys(), files.profiles()]);
    const map = <T>(items: Array<{ id: string; value: T }>) => new Map(items.map((each) => [each.id, each.value]));
    return { cases: map(cases.items), keys: map(keys.items), profiles: map(profiles.items) };
}
