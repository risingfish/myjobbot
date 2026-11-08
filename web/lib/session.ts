import { redirect } from "next/navigation.js";
import { currentSession, type SignedIn } from "./currentSession.js";

/** Returns this request's sign-in, sending the browser to the sign-in page before anything is read when there is none. */
export async function requireSession(): Promise<SignedIn> {
    const signedIn = await currentSession();
    if (signedIn === null) redirect("/sign-in");
    return signedIn;
}
