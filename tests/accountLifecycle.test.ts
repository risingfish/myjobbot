import { expect, test } from "vitest";
import { reactivateFirst } from "../src/accounts/accountLifecycle.js";
import { MESSAGES } from "../src/accounts/messages.js";

const ACTIVE = { deactivatedAt: null, deleteAfter: null };

test("an active account may score and connect Gmail", () => {
    expect(reactivateFirst(ACTIVE)).toBeNull();
});

test("a deactivated account is told to reactivate first", () => {
    expect(reactivateFirst({ deactivatedAt: "2026-11-09T10:00:00.000Z", deleteAfter: null })).toBe(MESSAGES.reactivate_first);
});
