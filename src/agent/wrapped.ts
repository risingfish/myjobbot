import { scrub, type DataMarkers } from "./markers.js";

interface Wrapping {
    outsideText: boolean;
    outcome: { content: string };
    markers: DataMarkers;
}

/** Prepares a tool's outcome for the model: outside text is scrubbed of look-alike markers and wrapped once in the run's markers. */
export function wrapOutcome({ outsideText, outcome, markers }: Wrapping): { content: string; hits: ReturnType<typeof scrub>["hits"] } {
    if (!outsideText) return { content: outcome.content, hits: [] };
    const { value, hits } = scrub(JSON.parse(outcome.content));
    return { content: `${markers.open}\n${JSON.stringify(value)}\n${markers.close}`, hits };
}
