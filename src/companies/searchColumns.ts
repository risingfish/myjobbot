import type { SearchRecord } from "../db/companyStore.js";
import type { AddressPick } from "./pickAddresses.js";

/** Turns a company search into the record's columns it changes: the addresses found, why the others weren't, their turned-down addresses, and when it ran. */
export function searchColumns(record: SearchRecord, at: string) {
    return { searched_at: at, ...websiteColumns(record.website), ...careersColumns(record.careers) };
}

/** Gives the website columns a search sets, or none when the website wasn't searched for. */
function websiteColumns(pick: AddressPick | null) {
    if (pick === null) return {};
    return { website_url: pick.url, website_reason: pick.reason, website_rejected: listOrNull(pick.rejected) };
}

/** Gives the careers columns a search sets: the page found, or why there was none and what was turned down. */
function careersColumns(pick: AddressPick | null) {
    if (pick === null) return {};
    if (pick.url !== null) return { careers_url: pick.url, careers_source: "search", careers_reason: null, careers_rejected: null };
    return { careers_reason: pick.reason, careers_rejected: listOrNull(pick.rejected) };
}

/** Stores a list of addresses as JSON, or nothing for an empty one. */
function listOrNull(addresses: string[]): string | null {
    return addresses.length === 0 ? null : JSON.stringify(addresses);
}
