import { createTransport } from "nodemailer";
import { afterEach, expect, test } from "vitest";
import { smtpMailer, transportOptions } from "../../src/mail/mailer.js";
import { queueMail } from "../../src/mail/queue.js";
import { SMTP_CERT, startFakeSmtp } from "../helpers/fakeSmtp.js";

const LOGIN = { user: "bot@example.com", pass: "right-password" };
let close = async () => {};

afterEach(async () => close());

test("the mailer sends one plain-text mail over STARTTLS with the sender's login, and a refused login is logged as auth", async () => {
    const server = await startFakeSmtp(LOGIN);
    close = server.close;
    const settings = { host: "localhost", port: server.port, user: LOGIN.user, password: LOGIN.pass, from: "myjobbot <bot@example.com>" };
    const mailer = smtpMailer(createTransport({ ...transportOptions(settings), tls: { ca: SMTP_CERT } }), settings.from);
    await mailer.send({ to: "ada@example.com", subject: "myjobbot: your account was created", text: "Hello Ada" });
    expect(server.received).toHaveLength(1);
    expect(server.received[0]).toMatchObject({ from: "<bot@example.com>", to: ["<ada@example.com>"] });
    expect(server.received[0]?.data).toContain("Subject: myjobbot: your account was created");
    const refused = smtpMailer(createTransport({ ...transportOptions({ ...settings, password: "wrong" }), tls: { ca: SMTP_CERT } }), settings.from);
    const lines: string[] = [];
    queueMail(refused, { to: "ada@example.com", subject: "s", text: "t" }, (line) => void lines.push(line));
    await expect.poll(() => lines).toEqual(["mail_failed auth"]);
}, 20_000);
