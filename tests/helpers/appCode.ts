import { Secret, TOTP } from "otpauth";

export function appCode(secret: string, at: string): string {
    return new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: Date.parse(at) });
}
