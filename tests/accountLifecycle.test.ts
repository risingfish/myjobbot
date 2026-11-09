import { expect, test } from "vitest";
import { reactivateFirst, statusOf } from "../src/accounts/accountLifecycle.js";
import { MESSAGES } from "../src/accounts/messages.js";

const ACTIVE = { deactivatedAt: null, deleteAfter: null };

test("an active account may score and connect Gmail", () => {
    expect(reactivateFirst(ACTIVE)).toBeNull();
});

test("a deactivated account is told to reactivate first", () => {
    expect(reactivateFirst({ deactivatedAt: "2026-11-09T10:00:00.000Z", deleteAfter: null })).toBe(MESSAGES.reactivate_first);
});

const NOW = "2026-11-09T10:00:00.000Z";

test("an account's status: active, deactivated, pending deletion, or held when its deletion is due and it is the only admin", () => {
    expect(statusOf(ACTIVE, NOW, false)).toBe("active");
    expect(statusOf({ deactivatedAt: NOW, deleteAfter: null }, NOW, true)).toBe("deactivated");
    expect(statusOf({ deactivatedAt: NOW, deleteAfter: "2026-12-09T10:00:00.000Z" }, NOW, true)).toBe("pending_deletion");
    expect(statusOf({ deactivatedAt: NOW, deleteAfter: "2026-11-01T10:00:00.000Z" }, NOW, false)).toBe("pending_deletion");
    expect(statusOf({ deactivatedAt: NOW, deleteAfter: "2026-11-01T10:00:00.000Z" }, NOW, true)).toBe("held");
});
