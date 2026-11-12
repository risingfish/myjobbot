import { toneFor, type Tone, type ToneBand } from "./tones.js";

const DAYS_OPEN_BANDS: readonly ToneBand[] = [
    { upTo: 0, tone: "good" },
    { upTo: 2, tone: "fair" },
    { upTo: 5, tone: "warn" },
];

/** Gives the tone for how long a job has been open: good the day it was seen, fair for the next two, a warning up to five, bad after. */
export function daysOpenTone(daysOpen: number): Tone {
    return toneFor(daysOpen, DAYS_OPEN_BANDS, "bad");
}
