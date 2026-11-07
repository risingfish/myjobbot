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

/** Builds the mail holding a one-time sign-in link. */
export function signInLink(name: string, link: string): MailContent {
    return { subject: "myjobbot: your sign-in link", text: `Hello ${name},\n\nOpen this link to sign in to myjobbot. It works once and expires in 15 minutes:\n\n${link}\n\nIf you didn't ask for it, you can ignore this mail.\n` };
}

/** Builds the mail holding a one-time password reset link. */
export function passwordReset(name: string, link: string): MailContent {
    return { subject: "myjobbot: reset your password", text: `Hello ${name},\n\nOpen this link to set a new myjobbot password. It works once and expires in 30 minutes:\n\n${link}\n\nIf you didn't ask for it, you can ignore this mail; your password stays as it is.\n` };
}

/** Builds the mail, sent to a new address, holding the link that confirms an email change. */
export function confirmNewEmail(name: string, link: string): MailContent {
    return { subject: "myjobbot: confirm your new email", text: `Hello ${name},\n\nOpen this link to make this your myjobbot email. It works once and expires in 24 hours:\n\n${link}\n\nIf you didn't ask for it, you can ignore this mail.\n` };
}

/** Builds the mail holding the link that confirms it's the account's holder, for the browser that asked. */
export function confirmItsYou(name: string, link: string): MailContent {
    return { subject: "myjobbot: confirm it's you", text: `Hello ${name},\n\nOpen this link in the browser where you asked for it, to confirm it's you. It works once and expires in 15 minutes:\n\n${link}\n` };
}

/** Builds the notice, sent to the old address, that an account's email was changed, with no link that undoes anything. */
export function emailChanged(name: string): MailContent {
    return { subject: "myjobbot: your email was changed", text: `Hello ${name},\n\nThe email of your myjobbot account was changed, and this address no longer signs in to it.\n\nIf this wasn't you, ask an admin for help.\n` };
}

/** Builds the test mail sent from the Account tab. */
export function testMail(name: string): MailContent {
    return { subject: "myjobbot: test email", text: `Hello ${name},\n\nThis is a test from myjobbot. Mail is working.\n` };
}
