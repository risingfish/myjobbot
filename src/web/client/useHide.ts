import { useState, type FormEvent } from "react";
import type { JobRowView } from "../api.js";

type HideStatus = "idle" | "saving" | "failed";

/** Hides or unhides a job on the server when its form is submitted, tracking whether the change is saving or failed. */
export function useHide(job: JobRowView, back: string, onHidden: (hidden: boolean) => void) {
  const [status, setStatus] = useState<HideStatus>("idle");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const saved = await sendHide(job, back);
    setStatus(saved ? "idle" : "failed");
    if (saved) onHidden(!job.hidden);
  };
  return { status, submit };
}

/** Posts the hide form the server already accepts, reporting whether the server saved the change. */
async function sendHide(job: JobRowView, back: string): Promise<boolean> {
  const body = new URLSearchParams({ ats: job.ats, job_id: job.jobId, hidden: job.hidden ? "0" : "1", back });
  const response = await fetch("/hide", { method: "POST", body, headers: { "x-myjobbot-fetch": "1" } }).catch(() => null);
  return response?.status === 204;
}
