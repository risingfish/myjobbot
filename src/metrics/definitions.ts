export interface MetricDefinition {
    name: string;
    help: string;
    labelNames: string[];
}

export interface MetricValue {
    name: string;
    labels: Record<string, string>;
    value: number;
}

export const METRICS: MetricDefinition[] = [
    { name: "myjobbot_last_run_started_timestamp_seconds", help: "When the latest run started.", labelNames: [] },
    { name: "myjobbot_last_run_finished_timestamp_seconds", help: "When the latest run that ended ended, 0 when none has.", labelNames: [] },
    { name: "myjobbot_last_run_ok", help: "1 when the latest run that ended finished cleanly, else 0.", labelNames: [] },
    { name: "myjobbot_runs_running", help: "Runs alive now.", labelNames: [] },
    { name: "myjobbot_runs", help: "Runs started in the window, by how they stand.", labelNames: ["status", "window"] },
    { name: "myjobbot_run_duration_seconds_max", help: "The longest run that ended in the window.", labelNames: ["window"] },
    { name: "myjobbot_source_fetches", help: "Source fetches in the window, by module and outcome.", labelNames: ["module", "outcome", "window"] },
    { name: "myjobbot_source_fetch_failures", help: "Failing source fetches in the window, by module and fixed reason.", labelNames: ["module", "reason", "window"] },
    { name: "myjobbot_source_jobs", help: "Jobs the sources found in the window, by module.", labelNames: ["module", "window"] },
    { name: "myjobbot_source_failing_streak_max", help: "The longest current run of failing fetches among a module's sources.", labelNames: ["module"] },
    { name: "myjobbot_careers_lookups", help: "Careers lookups in the window, by how they ended.", labelNames: ["outcome", "window"] },
    { name: "myjobbot_careers_page_reads", help: "Careers pages read in the window, by how each was read.", labelNames: ["read_by", "window"] },
    { name: "myjobbot_company_searches", help: "Company searches in the window: searched, and search steps that failed.", labelNames: ["outcome", "window"] },
    { name: "myjobbot_rescores", help: "Re-scores started in the window, by how they ended.", labelNames: ["outcome", "window"] },
    { name: "myjobbot_rescore_duration_seconds_max", help: "The longest re-score that ended in the window.", labelNames: ["window"] },
    { name: "myjobbot_model_calls", help: "Model calls in the window, by worker.", labelNames: ["worker", "window"] },
    { name: "myjobbot_model_tokens", help: "Model tokens in the window, by worker and kind.", labelNames: ["worker", "kind", "window"] },
    { name: "myjobbot_mail_sends", help: "Mail sends in the window, by kind and outcome.", labelNames: ["kind", "outcome", "window"] },
    { name: "myjobbot_mail_failure_streak", help: "Mail failures since the last mail sent.", labelNames: [] },
    { name: "myjobbot_jsearch_budget_used_ratio", help: "This month's JSearch requests over the cap.", labelNames: [] },
];
