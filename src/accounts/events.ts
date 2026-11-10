export type SecurityEventName =
    | "signed_in"
    | "signin_failed"
    | "locked"
    | "password_changed"
    | "password_reset"
    | "method_enabled"
    | "method_disabled"
    | "key_added"
    | "key_removed"
    | "app_added"
    | "app_removed"
    | "recovery_codes_made"
    | "recovery_code_used"
    | "email_changed"
    | "admin_granted"
    | "admin_removed"
    | "admin_email_change"
    | "code_made"
    | "signed_out_elsewhere"
    | "device_signed_out"
    | "key_counter_error"
    | "account_deactivated"
    | "account_reactivated"
    | "deletion_requested"
    | "deletion_cancelled";

const LABELS: Record<SecurityEventName, string> = {
    signed_in: "Signed in",
    signin_failed: "Sign-in failed",
    locked: "Sign-in was locked for 15 minutes after too many failed tries",
    password_changed: "Password changed",
    password_reset: "Password reset",
    method_enabled: "A way of signing in was turned on",
    method_disabled: "A way of signing in was turned off",
    key_added: "Hardware key added",
    key_removed: "Hardware key removed",
    app_added: "Authenticator app set up",
    app_removed: "Authenticator app removed",
    recovery_codes_made: "New recovery codes made",
    recovery_code_used: "A recovery code was used to sign in",
    email_changed: "Email changed",
    admin_granted: "Admin mark granted",
    admin_removed: "Admin mark removed",
    admin_email_change: "Email changed by an admin",
    code_made: "Account creation code made",
    signed_out_elsewhere: "Signed out everywhere else",
    device_signed_out: "A device was signed out",
    key_counter_error: "A hardware key answered out of order and was refused",
    account_deactivated: "Account deactivated",
    account_reactivated: "Account reactivated",
    deletion_requested: "Account deletion requested",
    deletion_cancelled: "Account deletion cancelled",
};

const NOTICED = new Set<SecurityEventName>(["locked", "password_changed", "password_reset", "method_enabled", "method_disabled", "key_added", "key_removed", "app_added", "app_removed", "recovery_codes_made", "recovery_code_used", "admin_granted", "admin_removed", "account_deactivated", "account_reactivated", "deletion_requested", "deletion_cancelled"]);

/** Returns a security event's fixed wording, as the Account tab shows it. */
export function eventLabel(event: SecurityEventName): string {
    return LABELS[event];
}

/** Returns what the account's owner is emailed about a security event, or null for one that needs no notice. */
export function noticeFor(event: SecurityEventName): string | null {
    return NOTICED.has(event) ? LABELS[event] : null;
}
