import type { ToolContext } from "../../tools/context.js";
import type { JsearchAccess } from "../modules/jsearch.js";
import type { RunHook } from "../runHooks.js";

export type JsearchContext = Pick<ToolContext, "config" | "jsearchApiKey">;

export const jsearchHook: RunHook<JsearchAccess | undefined, JsearchContext> = { access: async (context) => (context.jsearchApiKey === null ? undefined : { apiKey: context.jsearchApiKey, settings: context.config.jsearch }) };
