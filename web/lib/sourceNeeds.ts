import type { UserStores } from "../../src/db/userStores.js";
import { gmailConnected } from "../../src/gmail/alertJobs/usable.js";
import type { Met } from "../../src/sources/module.js";

/** Reports which source requirements are set up: the JSearch key, and a Gmail connection. */
export async function metNeeds(opened: Pick<UserStores, "gmail">): Promise<Met> {
    return { jsearch_key: Boolean(process.env.JSEARCH_API_KEY), gmail: gmailConnected(await opened.gmail.connection()) };
}
