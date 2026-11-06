export const MESSAGES = {
    signin_failed: "That didn't work. Check your details and try again.",
    password_rule: "Use 10 to 128 characters with a lowercase letter, an uppercase letter, a digit and a symbol.",
    email_invalid: "Enter a valid email address.",
    limited: "Too many tries. Wait a few minutes and try again.",
    signed_out: "You're signed out. Sign in again.",
    not_admin: "Only an admin can do that.",
    page_failed: "Something went wrong loading this page. Try again.",
    base_url: "myjobbot: MYJOBBOT_BASE_URL is missing or not allowed (see .env.example).",
} as const;
