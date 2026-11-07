"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import { confirmIdentity, requestStepUpLink } from "../../lib/accountActions.js";
import { WayChoice, type Way } from "./WayChoice.js";

interface Answer {
    ok: boolean;
    message?: string;
    stepUp?: true;
}

type Run = <T extends Answer>(call: () => Promise<T>) => Promise<T>;

interface Pending {
    call: () => Promise<Answer>;
    resolve: (answer: Answer) => void;
    first: Answer;
}

const StepUpContext = createContext<Run>((call) => call());

/** Returns what a change's answer shows: its refusal, or nothing when it went through or only asked the holder to confirm it's them. */
export function shownRefusal(answer: Answer): string | null {
    return answer.ok || answer.stepUp ? null : (answer.message ?? null);
}

/** Returns the function that runs a sensitive change, asking the account holder to confirm it's them first when the server says so. */
export function useStepUp(): Run {
    return useContext(StepUpContext);
}

/** Renders the dialog's form: the way to confirm it's you and its field, with why it was refused under it; its buttons sit in the dialog's footer. */
function StepUpForm({ message, onConfirm }: { message: string | null; onConfirm: (form: FormData) => Promise<void> }) {
    const [way, setWay] = useState<Way>("password");
    return (
        <form id="step-up-form" action={onConfirm}>
            <WayChoice way={way} onWay={setWay} refusal={message} legend="Confirm with" />
        </form>
    );
}

/** Renders the button that mails a confirmation link for this browser instead, returning to this page, and what it answered. */
function EmailMeLink() {
    const [note, setNote] = useState<string | null>(null);
    const send = async () => setNote((await requestStepUpLink(`${window.location.pathname}${window.location.search}`)).message ?? null);
    return (
        <p>
            <button type="button" className="secondary outline" onClick={() => void send()}>
                Email me a confirmation link
            </button>
            {note !== null && <small role="status"> {note}</small>}
        </p>
    );
}

/** Returns the dialog's refusal and its two answers: confirm, then make the change again, or cancel and leave it unmade. */
function useStepUpAnswers(pending: Pending, onDone: () => void) {
    const [message, setMessage] = useState<string | null>(null);
    const confirmNow = async (form: FormData) => {
        const way = String(form.get("way") ?? "password");
        const answer = await confirmIdentity(way, String(form.get(way === "password" ? "password" : "code") ?? ""));
        if (!answer.ok) return setMessage(answer.message);
        pending.resolve(await pending.call());
        onDone();
    };
    const cancel = () => {
        pending.resolve(pending.first);
        onDone();
    };
    return { message, confirmNow, cancel };
}

/** Renders the "Confirm it's you" dialog: the password, then the change is made again; Cancel leaves it unmade. */
function StepUpDialog({ pending, onDone }: { pending: Pending; onDone: () => void }) {
    const { message, confirmNow, cancel } = useStepUpAnswers(pending, onDone);
    return (
        <dialog open className="step-up" aria-labelledby="step-up-title">
            <article>
                <h3 id="step-up-title">Confirm it&apos;s you</h3>
                <p>{MESSAGES.step_up}</p>
                <StepUpForm message={message} onConfirm={confirmNow} />
                <EmailMeLink />
                <footer>
                    <button form="step-up-form">Confirm</button>
                    <button type="button" className="secondary" onClick={cancel}>
                        Cancel
                    </button>
                </footer>
            </article>
        </dialog>
    );
}

/** Lets the changes inside it ask the account holder to confirm it's them, showing the dialog when one does. */
export function StepUpProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null);
    const run = useCallback<Run>(async (call) => {
        const answer = await call();
        if (!answer.stepUp) return answer;
        return new Promise((resolve) => setPending({ call, resolve: resolve as (answer: Answer) => void, first: answer }));
    }, []);
    return (
        <StepUpContext value={run}>
            {children}
            {pending !== null && <StepUpDialog pending={pending} onDone={() => setPending(null)} />}
        </StepUpContext>
    );
}
