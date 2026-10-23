import type { DescriptionDetail, DescriptionOrigin } from "../../../src/web/api.js";
import { MarkdownText } from "./MarkdownText.js";
import { Fact, PanelSection } from "./PanelSection.js";

/** Shows the job's description in the details panel, with its requirements and skills and where it came from. */
export function DescriptionSection({ description }: { description: DescriptionDetail }) {
    return (
        <PanelSection title="Description">
            {description.origin !== null && <Origin origin={description.origin} />}
            <DescriptionLists description={description} />
            <DescriptionText description={description} />
        </PanelSection>
    );
}

/** Shows the description itself: formatted when it is Markdown, as text with its line breaks otherwise, or says there is none. */
function DescriptionText({ description }: { description: DescriptionDetail }) {
    if (description.text === null) return <p>No description found.</p>;
    if (description.format === "markdown") return <MarkdownText text={description.text} />;
    return <p className="details-text">{description.text}</p>;
}

/** Says where the description came from, linking the careers page it was found on. */
function Origin({ origin }: { origin: DescriptionOrigin }) {
    if (origin.kind === "source") return <p className="details-origin">From the job&apos;s own listing.</p>;
    if (origin.url === null) return <p className="details-origin">From the careers page.</p>;
    return (
        <p className="details-origin">
            From{" "}
            <a href={origin.url} target="_blank" rel="noopener noreferrer">
                the careers page
            </a>
            .
        </p>
    );
}

/** Lists the job's requirements and skills, leaving out any it doesn't have. */
function DescriptionLists({ description }: { description: DescriptionDetail }) {
    const lists: Array<[string, string[]]> = [
        ["Requirements", description.requirements],
        ["Skills", description.skills],
        ["Preferred skills", description.preferredSkills],
    ];
    const present = lists.filter(([, items]) => items.length > 0);
    if (present.length === 0) return null;
    return (
        <dl className="details-facts">
            {present.map(([label, items]) => (
                <Fact key={label} label={label} value={items.join(", ")} />
            ))}
        </dl>
    );
}
