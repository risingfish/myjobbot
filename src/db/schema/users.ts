import type { ColumnType, Generated } from "kysely";
import type { Count, Text } from "./columns.js";

export interface UsersTable {
    id: Generated<number>;
    name: string;
    created_at: string;
    email: ColumnType<string | null, string | null | undefined, string | null>;
    email_key: ColumnType<string | null, string | null | undefined, string | null>;
    is_admin: Generated<number>;
    deactivated_at: ColumnType<string | null, string | null | undefined, string | null>;
    delete_after: ColumnType<string | null, string | null | undefined, string | null>;
}

export interface UserSettingsTable {
    user_id: number;
    settings: ColumnType<unknown, string, string>;
    updated_at: string;
}

export interface UserSourcesTable {
    id: Generated<number>;
    user_id: number;
    module: string;
    name: string;
    params: ColumnType<unknown, string, string>;
    target: string;
    enabled: number;
    company_id: Count;
    cursor: ColumnType<unknown, string | null, string | null>;
    last_fetched_at: Text;
    last_outcome: Text;
    last_jobs: Count;
    last_cost: Count;
    last_reason: Text;
    created_at: string;
    updated_at: string;
}
