import type { AlertRead, AlertStateRow, AlertStore } from "../../src/db/store.js";

export class MemoryAlertStore implements AlertStore {
    private row: AlertStateRow | null = null;

    async state(): Promise<AlertStateRow | null> {
        return this.row === null ? null : { ...this.row };
    }

    async recordRead(read: AlertRead, at: string): Promise<void> {
        this.row = { uid_validity: read.uidValidity, last_uid: read.lastUid, last_run_at: at, emails_read: read.emails, jobs_found: read.jobs, not_understood: read.notUnderstood };
    }

    async clear(): Promise<void> {
        this.row = null;
    }
}
