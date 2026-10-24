import { normalizeCompany } from "../jobs/company.js";

interface SeenName {
    name: string;
    firstSeen: string;
    lastSeen: string;
}

export interface CompanyKey extends SeenName {
    key: string;
}

/** Groups company names into one entry per company, with its earliest first-seen and latest last-seen, named after its earliest-seen job. */
export function companyKeys(entries: SeenName[]): CompanyKey[] {
    const byKey = new Map<string, CompanyKey>();
    for (const entry of entries) {
        const key = normalizeCompany(entry.name);
        if (key !== "") byKey.set(key, merged(byKey.get(key), { ...entry, key }));
    }
    return [...byKey.values()];
}

/** Folds one more sighting into a company's entry, keeping the name of whichever was seen first and the earlier entry on a tie. */
function merged(current: CompanyKey | undefined, next: CompanyKey): CompanyKey {
    if (current === undefined) return next;
    const name = next.firstSeen < current.firstSeen ? next.name : current.name;
    const firstSeen = next.firstSeen < current.firstSeen ? next.firstSeen : current.firstSeen;
    const lastSeen = next.lastSeen > current.lastSeen ? next.lastSeen : current.lastSeen;
    return { key: current.key, name, firstSeen, lastSeen };
}
