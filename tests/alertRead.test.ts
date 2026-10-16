import { expect, test } from "vitest";
import { alertSearch, unreadUids } from "../src/gmail/alertJobs/read.js";

const SENDERS = ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com"];
const FROM = "from:(jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com)";

test("the search continues after the marker, or looks back 7 days when there is no usable marker", () => {
    expect(alertSearch({ senders: SENDERS, marker: { uid_validity: 7, last_uid: 100 }, uidValidity: 7 })).toEqual({ search: { gmraw: FROM, uid: "101:*" }, sinceUid: 100 });
    const fallback = { search: { gmraw: `${FROM} newer_than:7d` }, sinceUid: 0 };
    expect(alertSearch({ senders: SENDERS, marker: null, uidValidity: 7 })).toEqual(fallback);
    expect(alertSearch({ senders: SENDERS, marker: { uid_validity: 6, last_uid: 100 }, uidValidity: 7 })).toEqual(fallback);
    expect(alertSearch({ senders: SENDERS, marker: { uid_validity: 7, last_uid: null }, uidValidity: 7 })).toEqual(fallback);
});

test("only messages after the marker are read, at most the newest 50", () => {
    expect(unreadUids([100], 100, 50)).toEqual([]);
    expect(unreadUids([99, 101, 103, 102], 100, 50)).toEqual([101, 102, 103]);
    const many = Array.from({ length: 60 }, (_, index) => index + 1);
    expect(unreadUids(many, 0, 50)).toEqual(many.slice(10));
});
