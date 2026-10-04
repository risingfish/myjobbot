import { expect, test } from "vitest";
import { escapedHtmlToText } from "../src/sources/htmlText.js";

test("escaped HTML becomes plain text with one line per block", () => {
  expect(escapedHtmlToText("&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;We &lt;strong&gt;ship&lt;/strong&gt; daily.&lt;br&gt;Remote OK&lt;/p&gt;")).toBe("About\nWe ship daily.\nRemote OK");
});

test("entities inside the text are decoded once, after tags are removed", () => {
  expect(escapedHtmlToText("&lt;p&gt;a &amp;lt;b&amp;gt; &amp;amp; &amp;#x41;&amp;#66;&lt;/p&gt;")).toBe("a <b> & AB");
});

test("unknown or out-of-range entities are left as written", () => {
  expect(escapedHtmlToText("&amp;bogus; &amp;#99999999;")).toBe("&bogus; &#99999999;");
});
