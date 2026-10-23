import TurndownService from "turndown";
import { isWebAddress } from "./webAddress.js";

const OPTIONS: TurndownService.Options = { headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*", strongDelimiter: "**", hr: "---" };

const REMOVED = new Set(["script", "style", "noscript", "noembed", "noframes", "template", "iframe", "frame", "frameset", "object", "embed", "applet", "param", "canvas", "svg", "math", "form", "input", "button", "select", "textarea", "option", "picture", "video", "audio", "source", "track", "head", "title", "meta", "link", "base"]);

const ADDRESS_BREAKERS = /[()\s]/g;

/** Builds a converter with the rules every description shares: unsafe elements and images dropped, only web links kept, code blocks rebuilt from what's left, and text that looks like markup escaped. */
function descriptionConverter(): TurndownService {
    const service = new TurndownService(OPTIONS);
    service.remove((node) => REMOVED.has(node.nodeName.toLowerCase()));
    service.addRule("dropImages", { filter: "img", replacement: () => "" });
    service.addRule("webLinks", { filter: "a", replacement: linkMarkdown });
    service.addRule("codeBlocks", { filter: isCodeBlock, replacement: fencedCode });
    const markdownEscape = service.escape.bind(service);
    service.escape = (text) => markdownEscape(text).replace(/&/g, "\\&").replace(/</g, "\\<").replace(/!$/, "\\!");
    return service;
}

/** Writes a link as [words](address) when it has words and a web address, as its words otherwise, and as nothing when it has no words. */
function linkMarkdown(content: string, node: TurndownService.Node): string {
    const words = content.trim();
    const href = ("getAttribute" in node ? node.getAttribute("href") : null) ?? "";
    if (words === "" || !isWebAddress(href)) return words;
    return `[${words}](${href.replace(ADDRESS_BREAKERS, addressEscape)})`;
}

/** Percent-encodes the characters that would end a Markdown link's address early. */
function addressEscape(char: string): string {
    if (char === "(") return "%28";
    return char === ")" ? "%29" : "%20";
}

/** Tells whether an element is a code block: a pre holding a code element. */
function isCodeBlock(node: HTMLElement): boolean {
    return node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE";
}

/** Fences a code block's converted content, which no longer holds anything dropped, with one more backtick than its longest run. */
function fencedCode(content: string): string {
    const longest = Math.max(2, ...(content.match(/`+/g) ?? []).map((run) => run.length));
    const fence = "`".repeat(longest + 1);
    return `\n\n${fence}\n${content}\n${fence}\n\n`;
}

const DESCRIPTIONS = descriptionConverter();

/** Converts a source's HTML description to Markdown that keeps only plain formatting and web links, or null when nothing readable is left. */
export function htmlToMarkdown(html: string): string | null {
    const markdown = DESCRIPTIONS.turndown(html).trim();
    return markdown === "" ? null : markdown;
}
