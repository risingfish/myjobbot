import type { SecurityEventName } from "../accounts/events.js";

export interface SecurityEvent {
    userId: number;
    at: string;
    address: string | null;
    event: SecurityEventName;
    method: string | null;
}

export interface SecurityEventLog {
    record(event: SecurityEvent): Promise<void>;
    recent(userId: number, limit: number): Promise<SecurityEvent[]>;
}
