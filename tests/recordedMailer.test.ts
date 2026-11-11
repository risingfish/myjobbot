import { expect, test, vi } from "vitest";
import type { MailLog, MailSend } from "../src/db/mailLog.js";
import { recordedMailer } from "../src/mail/recorded.js";

const AT = new Date("2026-11-10T01:00:00.000Z");
const MESSAGE = { to: "ada@example.com", kind: "sign_in_link" as const, subject: "myjobbot: your sign-in link", text: "secret link" };

function memoryLog(): MailLog & { sends: MailSend[] } {
    const sends: MailSend[] = [];
    return { sends, record: async (send) => void sends.push(send), pruneBefore: async () => {} };
}

test("a sent mail is recorded by its kind alone, never its address or text", async () => {
    const log = memoryLog();
    const send = vi.fn(async () => {});
    await recordedMailer({ send }, log, () => AT).send(MESSAGE);
    expect([send.mock.calls.length, log.sends]).toEqual([1, [{ at: AT.toISOString(), kind: "sign_in_link", outcome: "sent", reason: null }]]);
});

test("a failed mail is recorded with the queue's fixed reason and still fails, so the queue logs it as before", async () => {
    const log = memoryLog();
    const failing = { send: async () => Promise.reject(Object.assign(new Error("535 bad login for bot@example.com"), { code: "EAUTH" })) };
    await expect(recordedMailer(failing, log, () => AT).send(MESSAGE)).rejects.toThrow("535");
    expect(log.sends).toEqual([{ at: AT.toISOString(), kind: "sign_in_link", outcome: "failed", reason: "auth" }]);
});

test("a log that can't record never changes the send", async () => {
    const lines: string[] = [];
    const broken: MailLog = { record: () => Promise.reject(new Error("db down")), pruneBefore: async () => {} };
    const send = vi.fn(async () => {});
    await expect(recordedMailer({ send }, broken, () => AT, (line) => void lines.push(line)).send(MESSAGE)).resolves.toBeUndefined();
    expect([send.mock.calls.length, lines]).toEqual([1, ["mail_log_failed"]]);
});
