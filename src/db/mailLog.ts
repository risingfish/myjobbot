import type { MailFailureReason } from "../mail/failureReason.js";
import type { MailKind } from "../mail/messages.js";

export interface MailSend {
    at: string;
    kind: MailKind;
    outcome: "sent" | "failed";
    reason: MailFailureReason | null;
}

export interface MailLog {
    record(send: MailSend): Promise<void>;
    pruneBefore(cutoff: string): Promise<void>;
}
