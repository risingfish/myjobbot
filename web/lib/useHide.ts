import { useState, type FormEvent } from "react";
import type { JobRowView } from "../../src/web/api.js";
import { setJobHidden } from "./actions.js";

type HideStatus = "idle" | "saving" | "failed";

/** Hides or unhides a job on the server when its form is submitted, tracking whether the change is saving or failed. */
export function useHide(job: JobRowView, onHidden: (hidden: boolean) => void) {
  const [status, setStatus] = useState<HideStatus>("idle");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const saved = await sendHide(job);
    setStatus(saved ? "idle" : "failed");
    if (saved) onHidden(!job.hidden);
  };
  return { status, submit };
}

/** Asks the server to flip a job's hidden flag, reporting whether it saved the change. */
async function sendHide(job: JobRowView): Promise<boolean> {
  const result = await setJobHidden(job.ats, job.jobId, !job.hidden).catch(() => null);
  return result?.ok === true;
}
