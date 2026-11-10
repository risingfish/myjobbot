import { readFileSync } from "node:fs";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { TLSSocket } from "node:tls";

export const SMTP_CERT = readFileSync("tests/fixtures/smtp/cert.pem", "utf8");
const SMTP_KEY = readFileSync("tests/fixtures/smtp/key.pem", "utf8");

export interface ReceivedMail {
    from: string;
    to: string[];
    data: string;
}

interface Session {
    socket: Socket;
    secure: boolean;
    mail: ReceivedMail;
    inData: boolean;
}

interface Login {
    user: string;
    pass: string;
}

type Reply = (session: Session, argument: string) => void;

function write(session: Session, line: string): void {
    session.socket.write(`${line}\r\n`);
}

function hello(session: Session): void {
    write(session, "250-fake.localhost");
    if (!session.secure) write(session, "250-STARTTLS");
    write(session, "250 AUTH PLAIN");
}

function startTls(session: Session, onLine: (line: string) => void): void {
    write(session, "220 ready for TLS");
    session.socket.removeAllListeners("data");
    session.socket = new TLSSocket(session.socket, { isServer: true, key: SMTP_KEY, cert: SMTP_CERT });
    session.secure = true;
    listen(session.socket, onLine);
}

function authenticate(login: Login): Reply {
    return (session, argument) => {
        const [, user, pass] = Buffer.from(argument.replace(/^PLAIN\s+/i, ""), "base64")
            .toString("utf8")
            .split("\0");
        write(session, user === login.user && pass === login.pass ? "235 ok" : "535 authentication failed");
    };
}

function envelope(login: Login): Record<string, Reply> {
    return {
        AUTH: authenticate(login),
        MAIL: (session, argument) => void ((session.mail.from = argument.replace(/^FROM:\s*/i, "")), write(session, "250 ok")),
        RCPT: (session, argument) => void (session.mail.to.push(argument.replace(/^TO:\s*/i, "")), write(session, "250 ok")),
        DATA: (session) => void ((session.inData = true), write(session, "354 go ahead")),
        QUIT: (session) => void (write(session, "221 bye"), session.socket.end()),
        RSET: (session) => write(session, "250 ok"),
        NOOP: (session) => write(session, "250 ok"),
    };
}

function listen(socket: Socket, onLine: (line: string) => void): void {
    let buffered = "";
    socket.on("data", (chunk: Buffer) => {
        buffered += chunk.toString("utf8");
        const lines = buffered.split("\r\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) onLine(line);
    });
}

function dataLine(session: Session, line: string, received: ReceivedMail[]): void {
    if (line !== ".") {
        session.mail.data += `${line}\n`;
        return;
    }
    received.push(session.mail);
    session.mail = { from: "", to: [], data: "" };
    session.inData = false;
    write(session, "250 queued");
}

function serve(socket: Socket, received: ReceivedMail[], login: Login): void {
    const session: Session = { socket, secure: false, mail: { from: "", to: [], data: "" }, inData: false };
    const replies = envelope(login);
    const onLine = (line: string): void => {
        if (session.inData) return dataLine(session, line, received);
        const [verb = "", ...rest] = line.split(" ");
        const command = verb.toUpperCase();
        if (command === "EHLO" || command === "HELO") return hello(session);
        if (command === "STARTTLS") return startTls(session, onLine);
        (replies[command] ?? ((s: Session) => write(s, "502 unknown")))(session, rest.join(" "));
    };
    listen(socket, onLine);
    write(session, "220 fake.localhost ESMTP");
}

export async function startFakeSmtp(login: Login): Promise<{ port: number; received: ReceivedMail[]; close: () => Promise<void> }> {
    const received: ReceivedMail[] = [];
    const server = createServer((socket) => serve(socket, received, login));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
    return { port: (server.address() as AddressInfo).port, received, close };
}
