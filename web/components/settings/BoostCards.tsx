import type { SaveResult } from "../../../src/web/settingsSave.js";
import { BOOST_FIELDS, type BoostField } from "../../../src/web/settingsSections.js";
import type { FieldView } from "../../../src/web/settingsView.js";
import { BoostTags } from "./BoostTags.js";
import { Problems, SettingCard } from "./SettingParts.js";

type Boosts = FieldView<Array<[string, number]>>;

export type BoostLists = Record<BoostField, Boosts>;

interface BoostCardsProps {
    lists: BoostLists;
    result: SaveResult | null;
    onChange: (field: BoostField) => (boosts: Boosts) => void;
}

const CARDS: Record<BoostField, { title: string; about: string }> = {
    title_boosts: { title: "Title Boosts", about: "Points added when a job's title has the term, such as a role or level (senior, web developer). Each term counts only once, however often it appears." },
    description_boosts: { title: "Description Boosts", about: "Points added when a job's description mentions the term, such as a skill or language (TypeScript, mentoring). Each term counts only once, however often it appears." },
};

/** Renders the two boost lists as cards side by side in a Pico grid, as the Filters groups are, each saying what its list does above its tags and problems. */
export function BoostCards({ lists, result, onChange }: BoostCardsProps) {
    return (
        <div className="grid">
            {BOOST_FIELDS.map((field) => (
                <SettingCard key={field} title={CARDS[field].title}>
                    <p className="note">{CARDS[field].about}</p>
                    <BoostTags field={field} label={CARDS[field].title} boosts={lists[field]} result={result} onChange={onChange(field)} />
                    <Problems result={result} field={field} />
                </SettingCard>
            ))}
        </div>
    );
}
