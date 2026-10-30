import type { SourceModule } from "./module.js";
import { ashby } from "./modules/ashby.js";
import { gmailAlerts } from "./modules/gmailAlerts.js";
import { greenhouse } from "./modules/greenhouse.js";
import { jsearch } from "./modules/jsearch.js";
import { lever } from "./modules/lever.js";
import { workday } from "./modules/workday.js";

export const MODULES: readonly SourceModule<unknown>[] = [greenhouse, lever, ashby, workday, jsearch, gmailAlerts];

/** Finds the source module shipped with the app under an id, or null when no module has it. */
export function moduleFor(id: string): SourceModule<unknown> | null {
    return MODULES.find((module) => module.id === id) ?? null;
}

export interface RecognizedLink {
    module: string;
    params: unknown;
    name: string;
}

/** Finds the source module a pasted jobs page link belongs to, with the fields it gives and a name to offer, or null when no module recognises it. */
export function recognizeLink(link: string): RecognizedLink | null {
    const trimmed = link.trim();
    const url = URL.parse(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url === null) return null;
    for (const module of MODULES) {
        const params = module.fromUrl?.(url) ?? null;
        if (params !== null) return { module: module.id, params, name: module.suggestName?.(params) ?? "" };
    }
    return null;
}
