import type { Trace } from "../agent/trace.js";
import type { Settings } from "../config/schema.js";
import type { CareersStore } from "../db/careersStore.js";
import type { BrowserPort } from "./browser.js";

export interface LanCheckDeps {
    settings: Pick<Settings["careers_lookup"], "lan_probe_url">;
    careers: Pick<CareersStore, "audit">;
    trace: Trace;
    runId: string;
    now: () => Date;
}

const LAN_UNCHECKED = "LAN check not configured";
const PROBE_MS = 3000;

/** Builds the run's check of whether the browser can reach the configured LAN address, which traces and records it and gives a note when there is no address to check. */
export function checkBrowserLan(deps: LanCheckDeps): (port: BrowserPort) => Promise<string | null> {
    return async (port) => {
        const probe = deps.settings.lan_probe_url;
        if (probe === undefined) return LAN_UNCHECKED;
        const session = await port.session({});
        const reachable = await session.probe(probe, PROBE_MS).finally(() => session.close());
        deps.trace.write({ type: "render_check", url: probe, warning: reachable });
        await deps.careers.audit({ runId: deps.runId, at: deps.now().toISOString(), ats: "", jobId: "", company: "", step: "render_check", url: probe, outcome: reachable ? "failed" : "ok", reason: null, warning: reachable });
        return null;
    };
}
