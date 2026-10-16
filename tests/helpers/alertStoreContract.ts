import { expect, test } from "vitest";
import type { MakeStores } from "./storeContract.js";

const AT = "2026-10-15T12:00:00.000Z";
const LATER = "2026-10-15T20:00:00.000Z";
const READ = { uidValidity: 7, lastUid: 120, emails: 3, jobs: 14, notUnderstood: 1 };

async function case1(make: MakeStores) {
    const { alerts } = await make();
    expect(await alerts.state()).toBeNull();
    await alerts.recordRead(READ, AT);
    expect(await alerts.state()).toEqual({ uid_validity: 7, last_uid: 120, last_run_at: AT, emails_read: 3, jobs_found: 14, not_understood: 1 });
    await alerts.recordRead({ ...READ, lastUid: 130, emails: 1, jobs: 2, notUnderstood: 0 }, LATER);
    expect(await alerts.state()).toEqual({ uid_validity: 7, last_uid: 130, last_run_at: LATER, emails_read: 1, jobs_found: 2, not_understood: 0 });
}

async function case2(make: MakeStores) {
    const { alerts } = await make();
    await alerts.recordRead(READ, AT);
    await alerts.clear();
    expect(await alerts.state()).toBeNull();
}

async function case3(make: MakeStores) {
    const { alerts } = await make();
    await alerts.recordRead({ ...READ, uidValidity: 3000000001, lastUid: 3000000000 }, AT);
    expect(await alerts.state()).toMatchObject({ uid_validity: 3000000001, last_uid: 3000000000 });
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["recording a read replaces the last one", case1],
    ["clearing forgets the read marker and counts", case2],
    ["message numbers beyond 2^31 round-trip exactly", case3],
];

export function alertStoreContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
