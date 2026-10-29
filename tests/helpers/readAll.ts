import type { Job } from "../../src/jobs/job.js";
import type { SourceContext, SourceModule } from "../../src/sources/module.js";

export async function readAll<P>(module: SourceModule<P>, params: P, ctx: SourceContext): Promise<Job[]> {
    const jobs: Job[] = [];
    for await (const page of module.fetch(params, ctx, null)) jobs.push(...page.jobs);
    return jobs;
}
