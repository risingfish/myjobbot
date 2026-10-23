import { expect, test } from "vitest";
import { htmlToMarkdown, pageToMarkdown } from "../src/descriptions/toMarkdown.js";

const HIDDEN = ["<p hidden>secret</p>", '<li aria-hidden="true">secret</li>', '<h2 style="display:none">secret</h2>', '<div style="visibility: hidden">secret</div>', "<pre><code>shown<span hidden>secret</span></code></pre>"];

test("a careers page keeps the posting and its aside, but not the site's navigation, header or footer", () => {
    const page = "<header>Acme</header><nav>Jobs | About</nav><main><h1>Backend Engineer</h1><p>Build APIs.</p></main><aside>Benefits</aside><footer>© Acme</footer>";
    expect(pageToMarkdown(page)).toBe("# Backend Engineer\n\nBuild APIs.\n\nBenefits");
});

test.each(HIDDEN)("a careers page drops the hidden element %s with its text", (html) => {
    expect(pageToMarkdown(`<p>kept</p>${html}`)).not.toContain("secret");
});

test("the page rules never reach board descriptions, which keep their header text", () => {
    expect(htmlToMarkdown("<header>Team</header><p>Build APIs.</p>")).toBe("Team\n\nBuild APIs.");
});

test("a careers page follows the description rules too: no scripts, images or unsafe links", () => {
    expect(pageToMarkdown('<p>a<script>x</script><img src="y"><a href="javascript:z()">b</a></p>')).toBe("ab");
});
