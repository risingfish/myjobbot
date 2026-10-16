import { REFRESH_GRACE_HOURS } from "../../config/schema.js";

const MS_PER_HOUR = 3_600_000;

export interface AllowanceRequest {
    cap: number;
    usedThisMonth: number;
    searches: number;
    refreshHours: number;
    now: Date;
}

/** Returns how many JSearch lookups alerts may use now, after reserving what saved searches need for the rest of the month. */
export function lookupAllowance(request: AllowanceRequest): number {
    const hoursLeft = (startOfNextMonth(request.now).getTime() - request.now.getTime()) / MS_PER_HOUR;
    const reserve = request.searches * Math.ceil(hoursLeft / (request.refreshHours - REFRESH_GRACE_HOURS));
    return Math.max(0, request.cap - request.usedThisMonth - reserve);
}

/** Returns midnight UTC on the first day of the month after the given date. */
function startOfNextMonth(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
