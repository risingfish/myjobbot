import type { FetchMessageObject, ImapFlow, MessageStructureObject } from "imapflow";
import type { AlertEmail } from "./alertJobs/parse.js";
import { alertSearch, unreadUids, type AlertMarker } from "./alertJobs/read.js";

export interface ReadAlertsRequest {
    senders: string[];
    marker: AlertMarker | null;
    max: number;
}

export interface AlertMail {
    uidValidity: number;
    emails: AlertEmail[];
}

/** Reads the unread alert emails from an already open, read-only mailbox, fetching only their HTML parts. */
export async function readAlertMail(client: ImapFlow, request: ReadAlertsRequest): Promise<AlertMail> {
    const uidValidity = client.mailbox === false ? 0 : Number(client.mailbox.uidValidity);
    const plan = alertSearch({ senders: request.senders, marker: request.marker, uidValidity });
    const found = (await client.search(plan.search, { uid: true })) || [];
    const emails: AlertEmail[] = [];
    for (const uid of unreadUids(found, plan.sinceUid, request.max)) emails.push(await readOne(client, uid));
    return { uidValidity, emails };
}

/** Fetches one message's sender, subject and HTML body without marking it read. */
async function readOne(client: ImapFlow, uid: number): Promise<AlertEmail> {
    const message: Partial<FetchMessageObject> = (await client.fetchOne(String(uid), { envelope: true, bodyStructure: true }, { uid: true })) || {};
    const envelope = message.envelope ?? {};
    const part = message.bodyStructure === undefined ? null : htmlPart(message.bodyStructure);
    const html = part === null ? "" : await download(client, uid, part);
    return { uid, from: (envelope.from?.[0]?.address ?? "").toLowerCase(), subject: envelope.subject ?? "", html };
}

/** Finds the body part holding the HTML, walking nested multipart sections. */
function htmlPart(node: MessageStructureObject): string | null {
    if (node.type === "text/html") return node.part ?? "1";
    for (const child of node.childNodes ?? []) {
        const found = htmlPart(child);
        if (found !== null) return found;
    }
    return null;
}

/** Downloads one decoded body part as text. */
async function download(client: ImapFlow, uid: number, part: string): Promise<string> {
    const { content } = await client.download(String(uid), part, { uid: true });
    const chunks: Buffer[] = [];
    for await (const chunk of content ?? []) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
}
