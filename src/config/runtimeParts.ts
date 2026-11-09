import type { z } from "zod";
import { settingsSchema, type Settings } from "./schema.js";
import { isRawObject, splitSettings } from "./searchSettings.js";

/** Reads config.json's Gmail settings from its runtime part alone, so they can be used before any search settings are stored. */
export function gmailSettings(fileRaw: unknown): z.infer<typeof settingsSchema.shape.gmail> {
    return settingsSchema.shape.gmail.parse(runtimePart(fileRaw, "gmail"));
}

/** Reads config.json's HTTP and JSearch settings from its runtime part alone, so the Sources section works before any search settings are stored. */
export function sourceSettings(fileRaw: unknown): Pick<Settings, "http" | "jsearch"> {
    return { http: settingsSchema.shape.http.parse(runtimePart(fileRaw, "http")), jsearch: settingsSchema.shape.jsearch.parse(runtimePart(fileRaw, "jsearch")) };
}

/** Picks one key of config.json's runtime part, or undefined so its defaults apply. */
function runtimePart(fileRaw: unknown, key: string): unknown {
    const { runtime } = splitSettings(fileRaw);
    return isRawObject(runtime) ? runtime[key] : undefined;
}
