import { z } from "zod";
import type { Environment } from "../config/load.js";

export interface DbSettings {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

const dbEnv = z.object({
    MYJOBBOT_DB_HOST: z.string().min(1),
    MYJOBBOT_DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    MYJOBBOT_DB_NAME: z.string().min(1).default("myjobbot"),
    MYJOBBOT_DB_USER: z.string().min(1),
    MYJOBBOT_DB_PASSWORD: z.string().min(1),
});

const UNREACHABLE = new Set(["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENOTFOUND", "ECONNRESET", "PROTOCOL_CONNECTION_LOST"]);

/** Reads the MariaDB connection settings from the environment, naming any setting that is missing or invalid. */
export function parseDbSettings(environment: Environment): DbSettings {
    const parsed = dbEnv.safeParse(environment);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => settingProblem(issue, environment)).join("; "));
    const env = parsed.data;
    return { host: env.MYJOBBOT_DB_HOST, port: env.MYJOBBOT_DB_PORT, database: env.MYJOBBOT_DB_NAME, user: env.MYJOBBOT_DB_USER, password: env.MYJOBBOT_DB_PASSWORD };
}

/** Describes one bad setting by name only, so no value (such as the password) reaches a message. */
function settingProblem(issue: z.core.$ZodIssue, environment: Environment): string {
    const name = String(issue.path[0]);
    return environment[name] ? `${name} is invalid` : `${name} is not set`;
}

/** Turns a driver error into a short message about the server, never including the password. */
export function describeConnectionError(error: unknown, settings: DbSettings): Error {
    const where = `MariaDB at ${settings.host}:${settings.port}`;
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "ER_ACCESS_DENIED_ERROR") return new Error(`${where} rejected user ${settings.user}`, { cause: error });
    if (typeof code === "string" && UNREACHABLE.has(code)) return new Error(`can't reach ${where}`, { cause: error });
    const detail = (error instanceof Error ? error.message : String(error)).replaceAll(settings.password, "***");
    return new Error(`${where}: ${detail}`, { cause: error });
}
