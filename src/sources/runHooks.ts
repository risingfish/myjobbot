import type { SavedSource } from "../db/sourceStore.js";
import type { SourceRun } from "../tools/context.js";
import { gmailAlertsHook, type GmailAlertsContext } from "./hooks/gmailAlerts.js";
import { jsearchHook, type JsearchContext } from "./hooks/jsearch.js";
import type { SourcePage } from "./module.js";

export interface RunHook<A, C> {
    access(context: C, saved: SavedSource): Promise<A>;
    afterPage?(context: C, page: SourcePage, access: A): Promise<void>;
    afterFetch?(context: C, access: A): Promise<Partial<SourceRun>>;
}

export type HookContext = GmailAlertsContext & JsearchContext;

const HOOKS: Record<string, RunHook<unknown, HookContext>> = { gmail_alerts: gmailAlertsHook, jsearch: jsearchHook };

/** Finds the run hook a source's module has, giving it the access it fetches with and its steps after each page and after the fetch, or null for a module with none. */
export function hookFor(moduleId: string): RunHook<unknown, HookContext> | null {
    return HOOKS[moduleId] ?? null;
}
