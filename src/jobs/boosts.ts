import type { Settings } from "../config/schema.js";
import { readableDescription } from "../descriptions/readable.js";
import type { DescriptionFormat } from "./job.js";
import { hasWord, normalizeTitle } from "./normalize.js";

const MAX_SCORE = 100;

export interface BoostLists {
    title: Record<string, number>;
    description: Record<string, number>;
}

export interface AppliedBoost {
    term: string;
    where: "title" | "description" | "both";
    points: number;
}

export interface Boost {
    points: number;
    applied: AppliedBoost[];
}

export interface BoostedJob {
    title: string;
    description: string | null;
    description_format: DescriptionFormat | null;
}

interface Entry {
    term: string;
    points: number;
}

interface TermGroup {
    title?: Entry;
    description?: Entry;
}

interface MatchedTexts {
    title: string;
    description: string;
}

/** Reads the title and description boost lists from the settings. */
export function boostLists(settings: Pick<Settings, "title_boosts" | "description_boosts">): BoostLists {
    return { title: settings.title_boosts, description: settings.description_boosts };
}

/** Works out which boosts a job earns: title terms found in its title, description terms in its readable description, each term once at the higher value when both lists name it. */
export function appliedBoosts(job: BoostedJob, lists: BoostLists): Boost {
    const texts = { title: normalizeTitle(job.title), description: normalizeTitle(readableDescription(job.description, job.description_format) ?? "") };
    const applied = [...termGroups(lists)].flatMap(([key, group]) => appliedTerm(key, group, texts));
    return { points: applied.reduce((sum, boost) => sum + boost.points, 0), applied };
}

/** Adds a job's boost points to the model's score, capped at 100. */
export function boostedScore(score: number, boost: Boost): number {
    return Math.min(MAX_SCORE, score + boost.points);
}

/** Returns the points if every term matched, each once at its highest value, so the Recommended query keeps every job boosts could still lift. */
export function maxBoost(lists: BoostLists): number {
    return [...termGroups(lists).values()].reduce((sum, group) => sum + higherPoints(group.title, group.description), 0);
}

/** Groups both lists' entries by the term as matching reads it, keeping each list's highest points for a term, in title-list order and then the description list's other terms. */
function termGroups(lists: BoostLists): Map<string, TermGroup> {
    const groups = new Map<string, TermGroup>();
    for (const list of ["title", "description"] as const) {
        for (const [term, points] of Object.entries(lists[list])) addEntry(groups, list, { term, points });
    }
    return groups;
}

/** Puts one list's entry in its term's group, unless that list already gives the term more points. */
function addEntry(groups: Map<string, TermGroup>, list: keyof TermGroup, entry: Entry): void {
    const key = normalizeTitle(entry.term);
    const group = groups.get(key) ?? {};
    const current = group[list];
    if (key !== "" && (current === undefined || entry.points > current.points)) groups.set(key, { ...group, [list]: entry });
}

/** Says how one term boosts a job: where it was found and the higher points of the lists it was found through, or nothing when it was found nowhere. */
function appliedTerm(key: string, group: TermGroup, texts: MatchedTexts): AppliedBoost[] {
    const title = foundEntry(group.title, texts.title, key);
    const description = foundEntry(group.description, texts.description, key);
    const found = title ?? description;
    if (found === undefined) return [];
    return [{ term: found.term, where: placeFound(title, description), points: higherPoints(title, description) }];
}

/** Gives a list's entry for a term when the term is found in the text that list is matched against. */
function foundEntry(entry: Entry | undefined, text: string, key: string): Entry | undefined {
    return entry !== undefined && hasWord(text, key) ? entry : undefined;
}

/** Names where a term was found, from the entries found through the title list and the description list. */
function placeFound(title: Entry | undefined, description: Entry | undefined): AppliedBoost["where"] {
    if (title === undefined) return "description";
    return description === undefined ? "title" : "both";
}

/** Gives the higher points of a term's two list entries, counting a missing one as none. */
function higherPoints(title: Entry | undefined, description: Entry | undefined): number {
    return Math.max(title?.points ?? 0, description?.points ?? 0);
}
