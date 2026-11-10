import { checkEmail } from "./accounts/emails.js";
import { OWNER_ID } from "./db/owner.js";
import type { Stores } from "./db/store.js";
import type { UserStores } from "./db/userStores.js";

const FLAG = "--user";

export interface UserOption {
    email: string | undefined;
    rest: string[];
}

export interface Refused {
    refused: string;
}

/** Takes the `--user <email>` option out of a command's arguments, leaving the rest as given. */
export function userOption(args: string[]): UserOption {
    const at = args.findIndex((arg) => arg === FLAG || arg.startsWith(`${FLAG}=`));
    if (at === -1) return { email: undefined, rest: args };
    const joined = args[at]?.startsWith(`${FLAG}=`) === true;
    const email = joined ? (args[at]?.slice(FLAG.length + 1) ?? "") : (args[at + 1] ?? "");
    return { email, rest: args.filter((_, index) => index !== at && (joined || index !== at + 1)) };
}

/** Gives the stores of the user a command acts for: the one `--user` names, else user 1; refusing an email that is malformed or has no account, without repeating it, and refusing when user 1 is gone. */
export async function storesFor(stores: Stores, email: string | undefined): Promise<UserStores | Refused> {
    if (email === undefined) return (await stores.accounts.account(OWNER_ID)) === null ? { refused: "user 1 no longer exists; name an email with --user" } : stores.forUser(OWNER_ID);
    const checked = checkEmail(email);
    if (!checked.ok) return { refused: `${FLAG}: not a valid address` };
    const account = await stores.accounts.byEmailKey(checked.emailKey);
    return account === null ? { refused: `${FLAG}: no account with that email` } : stores.forUser(account.id);
}
