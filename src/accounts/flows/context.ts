import type { Account } from "../../db/accountStore.js";
import type { Session } from "../../db/sessionStore.js";
import type { Stores } from "../../db/store.js";
import type { Mailer } from "../../mail/mailer.js";
import type { RandomBytes } from "../tokens.js";

export interface MailSlot {
    mailer: Mailer;
    baseUrl: string;
}

export interface AuthContext {
    stores: Pick<Stores, "sessions" | "accounts" | "methods" | "tokens">;
    now: () => string;
    random: RandomBytes;
    mail: MailSlot | null;
    secretKey: Buffer | null;
}

export interface Actor {
    account: Account;
    session: Session;
    address: string;
}
