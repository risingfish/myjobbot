import { Parser } from "htmlparser2";

export interface RawLink {
    href: string;
    text: string;
    label: string;
    next: boolean;
}

export interface WalkedPage {
    lines: string[];
    links: RawLink[];
}

type Attributes = Record<string, string>;

const DROPPED = new Set(["head", "script", "style", "noscript", "template", "svg", "iframe", "canvas", "form", "nav", "header", "footer", "select", "button"]);
const BLOCKS = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "br", "section", "article", "main", "aside", "table", "dd", "dt", "blockquote"]);
const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden/i;

/** Walks a page's HTML once, keeping its visible text as lines and its links, and skipping chrome and hidden elements. */
export function walkPage(html: string): WalkedPage {
    const walker = new PageWalker();
    const parser = new Parser({ onopentag: (name, attributes) => walker.open(name, attributes), ontext: (text) => walker.text(text), onclosetag: (name) => walker.close(name) });
    parser.write(html);
    parser.end();
    return walker.result();
}

/** Tells whether an element is hidden from readers by an attribute or an inline style. */
function isHidden(attributes: Attributes): boolean {
    return "hidden" in attributes || attributes["aria-hidden"] === "true" || HIDDEN_STYLE.test(attributes.style ?? "");
}

class PageWalker {
    private readonly chunks: string[] = [];
    private readonly links: RawLink[] = [];
    private skipDepth = 0;
    private link: RawLink | null = null;

    /** Notes an opening tag: starts skipping dropped or hidden elements, breaks lines at blocks, and starts links. */
    open(name: string, attributes: Attributes): void {
        if (this.skipDepth > 0 || DROPPED.has(name) || isHidden(attributes)) {
            this.skipDepth += 1;
            return;
        }
        if (BLOCKS.has(name)) this.chunks.push("\n");
        if (name === "a" && attributes.href !== undefined) this.link = { href: attributes.href, text: "", label: attributes.title ?? attributes["aria-label"] ?? "", next: attributes.rel === "next" };
    }

    /** Keeps text that isn't inside a skipped element, as HTML whitespace, adding it to the open link too. */
    text(raw: string): void {
        if (this.skipDepth > 0) return;
        const text = raw.replace(/\s+/g, " ");
        this.chunks.push(text);
        if (this.link !== null) this.link.text += text;
    }

    /** Notes a closing tag: ends skipping, breaks lines after blocks, and finishes a link. */
    close(name: string): void {
        if (this.skipDepth > 0) {
            this.skipDepth -= 1;
            return;
        }
        if (BLOCKS.has(name)) this.chunks.push("\n");
        if (name === "a" && this.link !== null) {
            this.links.push(this.link);
            this.link = null;
        }
    }

    /** Returns the page's non-empty text lines, whitespace collapsed, and the links found. */
    result(): WalkedPage {
        const lines = this.chunks
            .join("")
            .split("\n")
            .map((line) => line.replace(/\s+/g, " ").trim())
            .filter((line) => line !== "");
        return { lines, links: this.links };
    }
}
