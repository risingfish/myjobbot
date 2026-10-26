import type { ReactNode } from "react";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { Panel } from "../sections/Panel.js";

const NEEDS_SOURCE = "Add a company board or a saved search: runs and the other pages need one.";
const NEEDS_SEARCH_KEY = "Saved searches need JSEARCH_API_KEY in .env; runs refuse to start without it.";

/** Renders the search settings in effect, section by section, marking each one that takes its default. */
export function SettingsSections({ view }: { view: SettingsView }) {
    return (
        <>
            <SourcesPanel view={view} />
            <PreferencesPanel view={view} />
            <ScoringPanel view={view} />
            <FiltersPanel view={view} />
        </>
    );
}

/** Renders the Sources section: the company boards and saved searches, with what a run still needs. */
function SourcesPanel({ view }: { view: SettingsView }) {
    const { companies, searches } = view.fields;
    return (
        <Panel title="Sources">
            {view.needsSource && <p className="note">{NEEDS_SOURCE}</p>}
            {view.needsSearchKey && <p className="note">{NEEDS_SEARCH_KEY}</p>}
            <Field label="Company boards" field={companies}>
                <Lines items={companies.value.map((board) => `${String(board.name)}: ${String(board.ats)} / ${String(board.slug)}`)} />
            </Field>
            <Field label="Saved searches" field={searches}>
                <Lines items={searches.value.map((search) => `${String(search.name)}: ${String(search.query)}`)} />
            </Field>
        </Panel>
    );
}

/** Renders the Preferences section: the free-text preferences the model reads. */
function PreferencesPanel({ view: { fields } }: { view: SettingsView }) {
    return (
        <Panel title="Preferences">
            <Field label="Preferences" field={fields.preferences}>
                <p className="preferences">{fields.preferences.value}</p>
            </Field>
        </Panel>
    );
}

/** Renders the Scoring section: the match threshold and the title boosts. */
function ScoringPanel({ view: { fields } }: { view: SettingsView }) {
    return (
        <Panel title="Scoring">
            <Field label="Match threshold" field={fields.match_threshold}>
                <p>{fields.match_threshold.value}</p>
            </Field>
            <Field label="Title boosts" field={fields.title_boosts}>
                <Lines items={fields.title_boosts.value.map(([term, points]) => `${term}: +${points}`)} />
            </Field>
        </Panel>
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
        <section>
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
