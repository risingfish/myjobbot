import type { ReactNode } from "react";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { Panel } from "../sections/Panel.js";
import { PreferencesSection } from "./PreferencesSection.js";
import { ScoringSection } from "./ScoringSection.js";
import { SourcesSection } from "./SourcesSection.js";

/** Renders the search settings in effect, section by section, marking each one that takes its default. */
export function SettingsSections({ view }: { view: SettingsView }) {
    return (
        <>
            <SourcesSection view={view} />
            <PreferencesSection view={view} />
            <ScoringSection view={view} />
            <FiltersPanel view={view} />
        </>
    );
}

/** Renders the Filters section: the title filter's lists and the excluded companies and publishers. */
function FiltersPanel({ view: { fields } }: { view: SettingsView }) {
    return (
        <Panel title="Filters">
            <TermField label="Title must include one of" field={fields.include} />
            <TermField label="Title must not include" field={fields.exclude} />
            <TermField label="Also excluded" field={fields.extra_exclude} />
            <TermField label="Excluded companies" field={fields.exclude_companies} />
            <TermField label="Excluded publishers" field={fields.exclude_publishers} />
        </Panel>
    );
}

/** Renders a list of terms as one field. */
function TermField({ label, field }: { label: string; field: FieldView<string[]> }) {
    return (
        <Field label={label} field={field}>
            <Lines items={field.value} />
        </Field>
    );
}

/** Renders one setting under its label, saying when it takes its default. */
function Field({ label, field, children }: { label: string; field: FieldView<unknown>; children: ReactNode }) {
    return (
        <section className="setting">
            <h5>
                {label}
                {field.isDefault && <small className="note"> (default)</small>}
            </h5>
            {children}
        </section>
    );
}

/** Renders a list of lines, or "none" when it is empty. */
function Lines({ items }: { items: string[] }) {
    if (items.length === 0) return <p className="note">none</p>;
    return (
        <ul>
            {items.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
            ))}
        </ul>
    );
}
