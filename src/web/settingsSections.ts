export const SECTION_NAMES = ["preferences", "scoring", "filters"] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export type FieldName = "preferences" | "match_threshold" | "title_boosts" | "include" | "exclude" | "extra_exclude" | "exclude_companies" | "exclude_publishers";

export interface FieldSpec {
    name: FieldName;
    section: SectionName;
    stored: string[];
    check: string[];
}

export const SECTIONS: readonly FieldSpec[] = [
    { name: "preferences", section: "preferences", stored: ["preferences"], check: ["preferences"] },
    { name: "match_threshold", section: "scoring", stored: ["match_threshold"], check: ["match_threshold"] },
    { name: "title_boosts", section: "scoring", stored: ["title_boosts"], check: ["title_boosts"] },
    { name: "include", section: "filters", stored: ["title_filter", "include"], check: ["title_filter", "include"] },
    { name: "exclude", section: "filters", stored: ["title_filter", "exclude"], check: ["title_filter", "exclude"] },
    { name: "extra_exclude", section: "filters", stored: ["title_filter", "extra_exclude"], check: ["title_filter", "extra_exclude"] },
    { name: "exclude_companies", section: "filters", stored: ["exclude_companies"], check: ["exclude_companies"] },
    { name: "exclude_publishers", section: "filters", stored: ["exclude_publishers"], check: ["jsearch", "exclude_publishers"] },
];

/** Lists the fields one section of the Settings page owns. */
export function fieldsOf(section: SectionName): FieldSpec[] {
    return SECTIONS.filter((field) => field.section === section);
}
