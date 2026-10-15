const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Shortens a job title to a readable length for the job tables, ending a cut title with an ellipsis. */
export function shortTitle(title: string, limit = 64): string {
    const characters = [...GRAPHEMES.segment(title)].map((part) => part.segment);
    if (characters.length <= limit) return title;
    return `${characters.slice(0, limit).join("").trimEnd()}…`;
}
