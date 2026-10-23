import { expect, test } from "vitest";
import { htmlToMarkdown } from "../src/descriptions/toMarkdown.js";

const KEPT: Array<[string, string, string]> = [
    ["a heading, bold and italic", "<h2>Role</h2><p>Build <b>APIs</b> and <i>ship</i>.</p>", "## Role\n\nBuild **APIs** and *ship*."],
    ["nested lists", "<ul><li>Go<ul><li>nested</li></ul></li><li>SQL</li></ul>", "-   Go\n    -   nested\n-   SQL"],
    ["a rule and a block quote", "<p>a</p><hr><blockquote>quote</blockquote>", "a\n\n---\n\n> quote"],
    ["inline code", "<p>run <code>npm test</code></p>", "run `npm test`"],
    ["a code block, fenced past its own backticks", "<pre><code>a ``` b</code></pre>", "````\na ``` b\n````"],
    ["a web link, its address made safe", '<p><a href="https://a.example/x y(1)">good</a></p>', "[good](https://a.example/x%20y%281%29)"],
];

const DROPPED_WHOLE = ["script", "style", "noscript", "noembed", "noframes", "template", "iframe", "object", "applet", "canvas", "svg", "math", "form", "button", "select", "textarea", "video", "audio", "picture"];

test.each(KEPT)("keeps %s", (_name, html, markdown) => {
    expect(htmlToMarkdown(html)).toBe(markdown);
});

test.each(DROPPED_WHOLE)("drops <%s> with everything inside it", (tag) => {
    expect(htmlToMarkdown(`<p>before</p><${tag}>secret</${tag}><p>after</p>`)).toBe("before\n\nafter");
});

test("drops images, comments, event handlers and styles, and anything inside a code block that would be dropped", () => {
    expect(htmlToMarkdown('<p onclick="x()" style="color:red">see <img src="https://t.example/p.png" alt="x"> here<!-- note --></p>')).toBe("see  here");
    expect(htmlToMarkdown("<pre><code>a<script>b</script></code></pre>")).toBe("```\na\n```");
});

test("keeps the words of wrappers and of links that aren't web links, and drops links with no words", () => {
    expect(htmlToMarkdown("<div><span><font>one</font></span></div><table><tr><td>cell</td></tr></table><aside>side</aside>")).toBe("one\n\ncell\n\nside");
    const links = '<p><a href="javascript:alert(1)">a</a> <a href="data:text/html,x">b</a> <a href="mailto:x@y.example">c</a> <a href="/apply">d</a> <a href="https://e.example"></a></p>';
    expect(htmlToMarkdown(links)).toBe("a b c d");
});

test.each(["java\tscript:call()", "java\nscript:call()", "&#106;avascript:call()", "&#x6A;avascript&#58;call()", "javascript&colon;call()", "%6Aavascript:call()", " JaVaScRiPt:call()"])("a link to %j is kept as its words only", (href) => {
    expect(htmlToMarkdown(`<p><a href="${href}">click</a></p>`)).toBe("click");
});

test("text that reads like HTML or Markdown stays text, and a ! before a link doesn't make it an image", () => {
    expect(htmlToMarkdown("<p>&lt;script&gt;alert(1)&lt;/script&gt; &lt;https://aws.example.com&gt; C* snake_case</p>")).toBe("\\<script>alert(1)\\</script> \\<https://aws.example.com> C\\* snake\\_case");
    expect(htmlToMarkdown("<p># not a heading</p>")).toBe("\\# not a heading");
    expect(htmlToMarkdown('<p>Wow!<a href="https://a.example">go</a></p>')).toBe("Wow\\![go](https://a.example)");
});

test("broken markup keeps its text, blank formatting is dropped, and nothing readable gives no description", () => {
    expect(htmlToMarkdown("<div><p>one<p>two</div></span><b>three")).toBe("one\n\ntwo\n\n**three**");
    expect(htmlToMarkdown("<ul><li><img src='x'></li></ul>")).toBe("-");
    for (const html of ["<p></p><li></li><h2> </h2>", "<script>x</script>", ""]) expect(htmlToMarkdown(html)).toBeNull();
});

test("outside code, no unescaped < survives", () => {
    const markdown = htmlToMarkdown("<p>a &lt;b&gt; <i>c</i></p><div onload='x'>&lt;img src=x onerror=alert(1)&gt;</div>") ?? "";
    expect(markdown).not.toMatch(/(?<!\\)</);
});
