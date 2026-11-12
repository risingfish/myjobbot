export type Tone = "good" | "fair" | "warn" | "bad";

export interface ToneBand {
    upTo: number;
    tone: Tone;
}

/** Picks the tone of the first band, in rising order, whose upper bound a value doesn't pass, or the given tone beyond them all. */
export function toneFor(value: number, bands: readonly ToneBand[], beyond: Tone): Tone {
    return bands.find((band) => value <= band.upTo)?.tone ?? beyond;
}

/** Gives the class that colours text in a tone, shared by every page that shows one. */
export function toneClass(tone: Tone): string {
    return `tone-${tone}`;
}
