export const SECTION_NAMES = ["preferences", "scoring", "filters"] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

interface FieldDeclaration {
    name: string;
    section: SectionName;
    stored: readonly string[];
    check: readonly string[];
}

export const SECTIONS = [
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
] as const satisfies readonly FieldDeclaration[];

export type FieldName = (typeof SECTIONS)[number]["name"];

export type FieldSpec = FieldDeclaration & { name: FieldName };

export const BOOST_FIELDS = ["title_boosts", "description_boosts"] as const;

export type BoostField = (typeof BOOST_FIELDS)[number];

/** Reports whether a field is one of the boost lists, whose rows are a term and its points. */
export function isBoostField(name: FieldName): name is BoostField {
    return (BOOST_FIELDS as readonly FieldName[]).includes(name);
}

/** Lists the fields one section of the Settings page owns. */
export function fieldsOf(section: SectionName): FieldSpec[] {
    return SECTIONS.filter((field: FieldSpec) => field.section === section);
}
