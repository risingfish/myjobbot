import type { ColumnType, Generated } from "kysely";

type Optional = ColumnType<string | null, string | null | undefined, string | null>;

interface TallyColumns {
    fetches: Generated<number>;
    fetch_failures: Generated<number>;
    jobs_found: Generated<number>;
    jobs_scored: Generated<number>;
    searches: Generated<number>;
    search_failures: Generated<number>;
    model_calls: Generated<number>;
    prompt_tokens: Generated<number>;
    completion_tokens: Generated<number>;
}

export interface AgentRunsTable extends TallyColumns {
    id: string;
    started_at: string;
    alive_at: string;
    ended_at: Optional;
    outcome: Optional;
    reason: Optional;
    incomplete: Generated<number>;
    users: Generated<number>;
    users_failed: Generated<number>;
    users_skipped: Generated<number>;
}

export interface RunUsersTable extends TallyColumns {
    run_id: string;
    user_id: number;
    part_id: Optional;
    started_at: string;
    ended_at: Optional;
    outcome: string;
    reason: Optional;
}

export interface SourceFetchesTable {
    id: Generated<number>;
    user_id: number;
    source_id: number;
    part_id: string;
    module: string;
    at: string;
    ms: number;
    outcome: string;
    reason: Optional;
    pages: Generated<number>;
    jobs: Generated<number>;
    cost: Generated<number>;
}

export interface MailSendsTable {
    id: Generated<number>;
    at: string;
    kind: string;
    outcome: string;
    reason: Optional;
}
