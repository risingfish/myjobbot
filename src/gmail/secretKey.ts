import type { Environment } from "../config/load.js";

export type SecretKeyStatus = { status: "missing" } | { status: "invalid" } | { status: "ok"; key: Buffer };

const KEY_BYTES = 32;

/** Reads MYJOBBOT_SECRET_KEY, the key that seals stored Gmail secrets, without ever echoing its value. */
export function secretKeyStatus(env: Environment): SecretKeyStatus {
    const text = env.MYJOBBOT_SECRET_KEY?.trim();
    if (!text) return { status: "missing" };
    const key = Buffer.from(text, "base64");
    if (key.length !== KEY_BYTES || key.toString("base64") !== text) return { status: "invalid" };
    return { status: "ok", key };
}
