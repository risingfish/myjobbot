import type { HostLookup } from "../../src/careers/fetchPage.js";

export function fakeDns(map: Record<string, string[]>): HostLookup {
    return async (host) => {
        const addresses = map[host];
        if (addresses === undefined) throw new Error(`ENOTFOUND ${host}`);
        return addresses;
    };
}

export function publicDns(): HostLookup {
    return async () => ["93.184.216.34"];
}
