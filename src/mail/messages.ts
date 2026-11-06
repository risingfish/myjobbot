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

/** Builds the security notice telling an account's owner what changed and when, with no link that undoes anything. */
export function securityNotice(input: { name: string; what: string; at: string }, baseUrl: string): MailContent {
    const when = `${input.at.slice(0, 16).replace("T", " ")} UTC`;
    return { subject: "myjobbot: security notice", text: `Hello ${input.name},\n\n${input.what} on your myjobbot account at ${when}.\n\nIf this wasn't you, sign in at ${baseUrl}/sign-in and change your password, or ask an admin for help.\n` };
}
