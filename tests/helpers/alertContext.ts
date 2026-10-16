import type { AlertEmail } from "../../src/gmail/alertJobs/parse.js";
import type { ToolContext } from "../../src/tools/context.js";
import { connectedStores, KEY } from "./alertFetchSetup.js";
import { testContext } from "./context.js";
import { fakeImap, type FakeImapScript } from "./fakeImap.js";
import { memoryStores } from "./memoryStore.js";

export async function alertContext(script: FakeImapScript = {}, emails: AlertEmail[] = []): Promise<ToolContext> {
    const stores = await connectedStores(memoryStores());
    const imap = fakeImap({ mailbox: { uidValidity: 7, emails }, ...script }).factory;
    const context = testContext({}, stores);
    return { ...context, gmail: { store: stores.gmail, alerts: stores.alerts, key: { status: "ok", key: KEY }, imap, usable: true } };
}
