import type { SaveStatus } from "../../lib/useSave.js";

/** Says a change couldn't be saved, once its save has failed. */
export function SaveFailedNote({ status }: { status: SaveStatus }) {
    if (status !== "failed") return null;
    return (
        <>
            {" "}
            <small className="note">Couldn't save — try again</small>
        </>
    );
}
