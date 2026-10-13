import type { JobRowView } from "../../../api.js";
import { useHide } from "../../useHide.js";

interface HideButtonProps {
  job: JobRowView;
  back: string;
  onHidden: (hidden: boolean) => void;
}

/** Renders the button that hides a job, or brings a hidden one back, saying so if the change fails. */
export function HideButton({ job, back, onHidden }: HideButtonProps) {
  const { status, submit } = useHide(job, back, onHidden);
  return (
    <form className="hide" onSubmit={(event) => void submit(event)}>
      <button disabled={status === "saving"}>{job.hidden ? "Unhide" : "Hide"}</button>
      {status === "failed" && <> <small className="note">Couldn't save — try again</small></>}
    </form>
  );
}
