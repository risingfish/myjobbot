"use client";

import NextLink from "next/link.js";
import type { Account } from "../../../src/db/accountStore.js";
import { utcMinutes } from "../../../src/time/minutes.js";

const Link = NextLink.default;

/** Renders, on every signed-in page, that the account is deactivated or due for deletion, linking to the Account tab to undo it; nothing for an active account. */
export function AccountBanner({ account }: { account: Pick<Account, "deactivatedAt" | "deleteAfter"> }) {
    if (account.deactivatedAt === null) return null;
    const pending = account.deleteAfter !== null;
    return (
        <p role="status" className="container-fluid">
            {pending ? `Your account will be deleted on ${utcMinutes(account.deleteAfter ?? "")}. ` : "Your account is deactivated: runs do nothing for you. "}
            <Link href="/account">{pending ? "Cancel deletion" : "Reactivate"}</Link>
        </p>
    );
}
