import { senderQuery } from "../alerts.js";

export interface AlertMarker {
    uid_validity: number | null;
    last_uid: number | null;
}

export interface AlertSearch {
    search: { gmraw: string; uid?: string };
    sinceUid: number;
}

/** Decides how to search for new alert mail: after the last message read, or the last 7 days when that can't be trusted. */
export function alertSearch(request: { senders: string[]; marker: AlertMarker | null; uidValidity: number }): AlertSearch {
    const from = senderQuery(request.senders);
    const last = request.marker?.uid_validity === request.uidValidity ? request.marker.last_uid : null;
    if (last === null || last === undefined) return { search: { gmraw: `${from} newer_than:7d` }, sinceUid: 0 };
    return { search: { gmraw: from, uid: `${last + 1}:*` }, sinceUid: last };
}

/** Keeps only messages after the last one read, at most the newest few, oldest first. */
export function unreadUids(uids: number[], sinceUid: number, max: number): number[] {
    return uids
        .filter((uid) => uid > sinceUid)
        .sort((left, right) => left - right)
        .slice(-max);
}
