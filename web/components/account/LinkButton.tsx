"use client";

import { useEffect, useRef, useState } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import type { LinkPurpose } from "../../../src/db/emailLinkStore.js";
import { parseLinkFragment } from "../../../src/web/linkFragment.js";
import { spendEmailLinkNow, type LinkAnswer } from "../../lib/signInActions.js";
import { Field } from "./Field.js";

interface PurposeShown {
    button: string;
    asksPassword: boolean;
    after: "follow" | { text: string; href: string; label: string };
}

const PURPOSES: Record<LinkPurpose, PurposeShown> = {
    signin: { button: "Sign in", asksPassword: false, after: "follow" },
    reset: { button: "Set new password", asksPassword: true, after: { text: "Your password is set, and every sign-in has ended.", href: "/sign-in", label: "Sign in" } },
    email_change: { button: "Confirm new email", asksPassword: false, after: { text: "Your email is changed.", href: "/account", label: "Back to your account" } },
    step_up: { button: "Confirm it's you", asksPassword: false, after: "follow" },
};

/** Reads the link from the address's fragment once, then clears it from the address bar so it isn't kept in history or shared; a second run of the effect, as in development, reuses what the first one read. */
function useLinkFromFragment(): { hash: string; purpose: LinkPurpose } | null | undefined {
    const [link, setLink] = useState<{ hash: string; purpose: LinkPurpose } | null | undefined>(undefined);
    const read = useRef<string | null>(null);
    useEffect(() => {
        if (read.current === null) {
            read.current = window.location.hash;
            window.history.replaceState(null, "", window.location.pathname);
        }
        const parsed = parseLinkFragment(read.current);
        setLink(parsed === null ? null : { hash: read.current, purpose: parsed.purpose });
    }, []);
    return link;
}

/** Shows what happened after the link was used: where to go next, or why it didn't work with a way to get a new one. */
function Outcome({ answer }: { answer: LinkAnswer }) {
    if (!answer.ok) {
        return (
            <p role="alert">
                {answer.message} <a href="/sign-in">Send a new link</a>
            </p>
        );
    }
    const { after } = PURPOSES[answer.kind];
    if (after === "follow") return <p role="status">Done.</p>;
    return (
        <p role="status">
            {after.text} <a href={after.href}>{after.label}</a>
        </p>
    );
}

/** Renders the form that uses a link: for a reset the new password, then the one button; nothing happens until it is pressed. */
function LinkForm({ link, onAnswer }: { link: { hash: string; purpose: LinkPurpose }; onAnswer: (answer: LinkAnswer) => void }) {
    const [refusal, setRefusal] = useState<LinkAnswer | null>(null);
    const use = async (form: FormData) => {
        const result = await spendEmailLinkNow(link.hash, form.get("password"));
        if (result.ok && PURPOSES[result.kind].after === "follow") window.location.assign(result.next);
        if (result.ok) return onAnswer(result);
        setRefusal(result);
    };
    const weak = refusal !== null && !refusal.ok && refusal.message === MESSAGES.password_rule;
    return (
        <form action={use}>
            {PURPOSES[link.purpose].asksPassword && <Field name="password" label="New password" type="password" autoComplete="new-password" required invalid={weak} note={MESSAGES.password_rule} />}
            <button type="submit">{PURPOSES[link.purpose].button}</button>
            {refusal !== null && !weak && <Outcome answer={refusal} />}
        </form>
    );
}

/** Renders the page an emailed link opens: the link read from the address's fragment, then its form, then what happened. */
export function LinkButton() {
    const link = useLinkFromFragment();
    const [answer, setAnswer] = useState<LinkAnswer | null>(null);
    if (link === undefined) return <p aria-busy="true">Reading the link…</p>;
    if (link === null) return <Outcome answer={{ ok: false, message: MESSAGES.link_expired }} />;
    return answer === null ? <LinkForm link={link} onAnswer={setAnswer} /> : <Outcome answer={answer} />;
}
