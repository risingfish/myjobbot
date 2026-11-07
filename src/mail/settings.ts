import { z } from "zod";

type Env = Record<string, string | undefined>;

export interface MailSettings {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
}

export type ParsedMail = { ok: true; settings: MailSettings | null } | { ok: false; message: string };

const KEYS = ["MYJOBBOT_SMTP_HOST", "MYJOBBOT_SMTP_PORT", "MYJOBBOT_SMTP_USER", "MYJOBBOT_SMTP_PASSWORD", "MYJOBBOT_MAIL_FROM"] as const;

const schema = z.object({
    MYJOBBOT_SMTP_HOST: z.string().min(1),
    MYJOBBOT_SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    MYJOBBOT_SMTP_USER: z.string().min(1),
    MYJOBBOT_SMTP_PASSWORD: z.string().min(1),
    MYJOBBOT_MAIL_FROM: z.string().min(1),
});

/** Reads the mail server settings: all five or none (mail off); a partial or bad set is refused naming a setting, never a value. */
export function parseMailSettings(env: Env): ParsedMail {
    const present = KEYS.filter((key) => env[key]);
    if (present.length === 0) return { ok: true, settings: null };
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        const key = KEYS.find((name) => !present.includes(name)) ?? String(parsed.error.issues[0]?.path[0]);
        return { ok: false, message: `myjobbot: mail is off until ${key} is set correctly (or none of the mail settings are set)` };
    }
    const data = parsed.data;
    return { ok: true, settings: { host: data.MYJOBBOT_SMTP_HOST, port: data.MYJOBBOT_SMTP_PORT, user: data.MYJOBBOT_SMTP_USER, password: data.MYJOBBOT_SMTP_PASSWORD, from: data.MYJOBBOT_MAIL_FROM } };
}
