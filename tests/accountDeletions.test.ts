import { expect, test } from "vitest";
import { carryOutDeletions } from "../src/app/accountDeletions.js";
import type { AccountRemoval, RemovalOutcome } from "../src/db/accountRemoval.js";
import type { MailMessage } from "../src/mail/mailer.js";

const NOW = "2026-12-09T10:00:00.000Z";
const ACCOUNTS = new Map([
    [2, { id: 2, name: "Ada", email: "ada@example.com", isAdmin: false, deactivatedAt: NOW, deleteAfter: NOW }],
    [3, { id: 3, name: "Bob", email: "bob@example.com", isAdmin: true, deactivatedAt: NOW, deleteAfter: NOW }],
]);

function removal(outcomes: Record<number, RemovalOutcome | Error>): AccountRemoval {
    return {
        due: async () => Object.keys(outcomes).map(Number),
        remove: async (userId) => {
            const outcome = outcomes[userId];
            if (outcome instanceof Error) throw outcome;
            return outcome ?? "gone";
        },
    };
}

function parts(outcomes: Record<number, RemovalOutcome | Error>) {
    const sent: MailMessage[] = [];
    return { sent, deps: { removal: removal(outcomes), accounts: { account: async (id: number) => ACCOUNTS.get(id) ?? null }, send: async (message: MailMessage) => void sent.push(message) } };
}

test("a due account is removed and then told, to the address read before; a held one is not told", async () => {
    const { deps, sent } = parts({ 2: "deleted", 3: "last_admin" });
    expect(await carryOutDeletions(deps, NOW)).toEqual([
        { userId: 2, deleted: true },
        { userId: 3, held: "last_admin" },
    ]);
    expect(sent.map((mail) => [mail.to, mail.subject])).toEqual([["ada@example.com", "myjobbot: your account was deleted"]]);
});

test("a deletion cancelled or already done is passed over quietly, and one that fails fails alone", async () => {
    const { deps, sent } = parts({ 2: "not_due", 3: new Error("lock wait timeout"), 4: "gone" });
    expect(await carryOutDeletions(deps, NOW)).toEqual([{ userId: 3, failed: "lock wait timeout", reason: "other" }]);
    expect(sent).toEqual([]);
});
