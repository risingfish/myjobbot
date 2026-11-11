import { expect, test, vi } from "vitest";
import { transportOptions } from "../src/mail/mailer.js";
import { accountCreated, accountDeleted, confirmItsYou, confirmNewEmail, emailChanged, passwordReset, securityNotice, signInLink, someoneTried, testMail } from "../src/mail/messages.js";
import { queueMail, sendMail } from "../src/mail/queue.js";
import { parseMailSettings } from "../src/mail/settings.js";

const FULL = { MYJOBBOT_SMTP_HOST: "smtp.example.com", MYJOBBOT_SMTP_PORT: "587", MYJOBBOT_SMTP_USER: "bot@example.com", MYJOBBOT_SMTP_PASSWORD: "hunter2-secret", MYJOBBOT_MAIL_FROM: "myjobbot <bot@example.com>" };

test("mail is set up by all five settings or none, and a partial set is refused naming the missing setting, never a value", () => {
    expect(parseMailSettings(FULL)).toEqual({ ok: true, settings: { host: "smtp.example.com", port: 587, user: "bot@example.com", password: "hunter2-secret", from: "myjobbot <bot@example.com>" } });
    expect(parseMailSettings({})).toEqual({ ok: true, settings: null });
    const partial = parseMailSettings({ ...FULL, MYJOBBOT_MAIL_FROM: undefined });
    expect(partial).toEqual({ ok: false, message: "myjobbot: mail is off until MYJOBBOT_MAIL_FROM is set correctly (or none of the mail settings are set)" });
    const badPort = parseMailSettings({ ...FULL, MYJOBBOT_SMTP_PORT: "nope" });
    expect(badPort).toEqual({ ok: false, message: "myjobbot: mail is off until MYJOBBOT_SMTP_PORT is set correctly (or none of the mail settings are set)" });
    expect(JSON.stringify(badPort)).not.toContain("hunter2");
});

test("port 465 connects over TLS from the start, and any other port must upgrade with STARTTLS", () => {
    const settings = { host: "h", port: 465, user: "u", password: "p", from: "f" };
    expect(transportOptions(settings)).toEqual({ host: "h", port: 465, secure: true, requireTLS: false, auth: { user: "u", pass: "p" } });
    expect(transportOptions({ ...settings, port: 587 })).toMatchObject({ secure: false, requireTLS: true });
});

test("account mails have fixed subjects and hold only the name, fixed text and the app's address", () => {
    expect(accountCreated("Ada Lovelace", "https://jobs.example.com")).toEqual({ kind: "account_created", subject: "myjobbot: your account was created", text: "Hello Ada Lovelace,\n\nYour myjobbot account was created.\n\nSign in at https://jobs.example.com/sign-in\n" });
    expect(someoneTried("https://jobs.example.com")).toEqual({ kind: "someone_tried", subject: "myjobbot: someone tried to make an account with your address", text: "Someone tried to make a myjobbot account with this address, which already has one. Nothing changed.\n\nIf it was you, sign in at https://jobs.example.com/sign-in\n" });
});

test("queuing a mail returns before it is sent, and a failure is logged by a fixed reason only", async () => {
    const log = vi.fn();
    let release = () => {};
    const sent = new Promise<void>((resolve) => (release = resolve));
    const slow = { send: vi.fn(() => sent) };
    expect(queueMail(slow, { to: "a@example.com", kind: "test", subject: "s", text: "t" }, log)).toBeUndefined();
    expect(slow.send).toHaveBeenCalledOnce();
    release();
    const failing = { send: vi.fn(async () => Promise.reject(Object.assign(new Error("535 bad login for bot@example.com"), { code: "EAUTH" }))) };
    queueMail(failing, { to: "a@example.com", kind: "test", subject: "s", text: "t" }, log);
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith("mail_failed auth"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("bot@example.com");
});

test("a mail that must go out before the process ends is waited for, and a failure is logged by its reason alone", async () => {
    const log = vi.fn();
    const sent = vi.fn(async () => {});
    await sendMail({ send: sent }, { to: "a@example.com", kind: "test", subject: "s", text: "t" }, log);
    expect(sent).toHaveBeenCalledOnce();
    await sendMail({ send: vi.fn(async () => Promise.reject(Object.assign(new Error("535 bad login for bot@example.com"), { code: "EAUTH" }))) }, { to: "a@example.com", kind: "test", subject: "s", text: "t" }, log);
    expect(log.mock.calls).toEqual([["mail_failed auth"]]);
});

test("every account mail says what kind it is, so its send can be counted without its address or text", () => {
    const base = "https://jobs.example.com";
    const kinds = [accountCreated("Ada", base), someoneTried(base), securityNotice({ name: "Ada", what: "Your password was changed", at: "2026-11-10T01:00:00.000Z" }, base), accountDeleted("Ada"), signInLink("Ada", "l"), passwordReset("Ada", "l"), confirmNewEmail("Ada", "l"), confirmItsYou("Ada", "l"), emailChanged("Ada"), testMail("Ada")].map((mail) => mail.kind);
    expect(kinds).toEqual(["account_created", "someone_tried", "security_notice", "account_deleted", "sign_in_link", "password_reset", "confirm_new_email", "confirm_its_you", "email_changed", "test"]);
});
