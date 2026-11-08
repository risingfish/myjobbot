import type { Generated } from "kysely";
import type { Count, Text } from "./columns.js";

export interface GmailConnectionTable {
    user_id: number;
    email: Text;
    app_password: Text;
    connected_at: Text;
    status: Generated<string>;
    reason: Text;
}

export interface GmailAlertStateTable {
    user_id: number;
    uid_validity: Count;
    last_uid: Count;
    last_run_at: Text;
    emails_read: Generated<number>;
    jobs_found: Generated<number>;
    not_understood: Generated<number>;
}
