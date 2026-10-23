import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { descriptionHeading, markdownHref } from "../../lib/markdown.js";

const ALLOWED = ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "strong", "em", "code", "pre", "a"];

/** Shows a description's link as one opening in a new tab that sends no referrer, or as plain words when its address isn't a web one. */
function DescriptionLink({ href, children }: { href?: string; children?: ReactNode }) {
    if (href === undefined || href === "") return <span>{children}</span>;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            {children}
        </a>
    );
}

/** Makes the component for one heading level of a description, placed below the panel's own headings. */
function headingAt(level: number): Components["h1"] {
    const Tag = descriptionHeading(level);
    return function DescriptionHeading({ children }) {
        return <Tag>{children}</Tag>;
    };
}

const COMPONENTS: Components = { a: DescriptionLink, h1: headingAt(1), h2: headingAt(2), h3: headingAt(3), h4: headingAt(4), h5: headingAt(5), h6: headingAt(6) };

/** Shows a Markdown description formatted, keeping only its plain formatting and web links: raw HTML, images and anything else are left out. */
export function MarkdownText({ text }: { text: string }) {
    return (
        <div className="details-markdown">
            <Markdown skipHtml allowedElements={ALLOWED} unwrapDisallowed urlTransform={markdownHref} components={COMPONENTS}>
                {text}
            </Markdown>
        </div>
    );
}
