export interface MailContent {
    subject: string;
    text: string;
}

/** Builds the mail telling a new account it was made. */
export function accountCreated(name: string, baseUrl: string): MailContent {
    return { subject: "myjobbot: your account was created", text: `Hello ${name},\n\nYour myjobbot account was created.\n\nSign in at ${baseUrl}/sign-in\n` };
}

/** Builds the mail telling an account's owner someone tried to make another account with their address. */
export function someoneTried(baseUrl: string): MailContent {
    return { subject: "myjobbot: someone tried to make an account with your address", text: `Someone tried to make a myjobbot account with this address, which already has one. Nothing changed.\n\nIf it was you, sign in at ${baseUrl}/sign-in\n` };
}
