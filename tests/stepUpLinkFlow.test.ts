import { expect, test } from "vitest";
import { requestStepUpLink, spendEmailLink } from "../src/accounts/flows/emailLinks.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { linkFrom } from "./helpers/linkFrom.js";
import { signedInOwner } from "./helpers/signedIn.js";

test("a confirm-it's-you link goes to the account's email bound to this sign-in, only with mail on and at most 3 in 15 minutes", async () => {
    const { ctx, actor, mailer } = await signedInOwner();
    expect(await requestStepUpLink(ctx, actor, "//evil.test")).toEqual({ ok: true, message: MESSAGES.step_up_sent });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["owner@example.com", "myjobbot: confirm it's you"]]);
    for (let tries = 0; tries < 4; tries += 1) await requestStepUpLink(ctx, actor, "/account");
    expect(mailer.sent).toHaveLength(3);
    expect(await requestStepUpLink({ ...ctx, mail: null }, actor, "/account")).toEqual({ ok: false, message: MESSAGES.mail_off });
});

test("the confirm link renews the proof of identity only in the browser that asked, and from another browser spends nothing", async () => {
    const { ctx, actor, mailer, clock } = await signedInOwner();
    clock.advance(20 * 60 * 1000);
    await requestStepUpLink(ctx, actor, "/account");
    const token = linkFrom(mailer, "step_up");
    const spend = { token, purpose: "step_up" as const, address: "direct", heldDigest: null };
    expect(await spendEmailLink(ctx, { ...spend, sessionDigest: tokenDigest("other") })).toEqual({ ok: false, message: MESSAGES.step_up_other_browser });
    expect(await spendEmailLink(ctx, { ...spend, sessionDigest: null })).toEqual({ ok: false, message: MESSAGES.step_up_other_browser });
    expect(await spendEmailLink(ctx, { ...spend, sessionDigest: actor.session.idDigest })).toEqual({ ok: true, kind: "step_up", next: "/account" });
    expect((await ctx.stores.sessions.find(actor.session.idDigest, ctx.now()))?.verifiedAt).toBe(ctx.now());
    expect(await spendEmailLink(ctx, { ...spend, sessionDigest: actor.session.idDigest })).toEqual({ ok: false, message: MESSAGES.link_expired });
});
