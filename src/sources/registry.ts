import type { SourceModule } from "./module.js";
import { ashby } from "./modules/ashby.js";
import { greenhouse } from "./modules/greenhouse.js";
import { jsearch } from "./modules/jsearch.js";
import { lever } from "./modules/lever.js";
import { workday } from "./modules/workday.js";

const MODULES: readonly SourceModule<unknown>[] = [greenhouse, lever, ashby, workday, jsearch];

/** Finds the source module shipped with the app under an id, or null when no module has it. */
export function moduleFor(id: string): SourceModule<unknown> | null {
    return MODULES.find((module) => module.id === id) ?? null;
}
