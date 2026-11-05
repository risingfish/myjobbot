export const SECTION_NAMES = ["preferences", "scoring", "filters"] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export type FieldName = "preferences" | "match_threshold" | "resume_view" | "title_boosts" | "description_boosts" | "include" | "exclude" | "extra_exclude" | "body_include" | "body_exclude" | "exclude_companies" | "exclude_publishers";

export interface FieldSpec {
    name: FieldName;
    section: SectionName;
    stored: string[];
    check: string[];
}

export const SECTIONS: readonly FieldSpec[] = [
    { name: "preferences", section: "preferences", stored: ["preferences"], check: ["preferences"] },
    { name: "match_threshold", section: "scoring", stored: ["match_threshold"], check: ["match_threshold"] },
    { name: "resume_view", section: "scoring", stored: ["resume_view"], check: ["resume_view"] },
    { name: "title_boosts", section: "scoring", stored: ["title_boosts"], check: ["title_boosts"] },
    { name: "description_boosts", section: "scoring", stored: ["description_boosts"], check: ["description_boosts"] },
    { name: "include", section: "filters", stored: ["title_filter", "include"], check: ["title_filter", "include"] },
    { name: "exclude", section: "filters", stored: ["title_filter", "exclude"], check: ["title_filter", "exclude"] },
    { name: "extra_exclude", section: "filters", stored: ["title_filter", "extra_exclude"], check: ["title_filter", "extra_exclude"] },
    { name: "body_include", section: "filters", stored: ["body_filter", "include"], check: ["body_filter", "include"] },
    { name: "body_exclude", section: "filters", stored: ["body_filter", "exclude"], check: ["body_filter", "exclude"] },
    { name: "exclude_companies", section: "filters", stored: ["exclude_companies"], check: ["exclude_companies"] },
    { name: "exclude_publishers", section: "filters", stored: ["exclude_publishers"], check: ["jsearch", "exclude_publishers"] },
];

export const BOOST_FIELDS = ["title_boosts", "description_boosts"] as const;

export type BoostField = (typeof BOOST_FIELDS)[number];

/** Reports whether a field is one of the boost lists, whose rows are a term and its points. */
export function isBoostField(name: FieldName): name is BoostField {
    return (BOOST_FIELDS as readonly FieldName[]).includes(name);
}

/** Lists the fields one section of the Settings page owns. */
export function fieldsOf(section: SectionName): FieldSpec[] {
    return SECTIONS.filter((field) => field.section === section);
}
