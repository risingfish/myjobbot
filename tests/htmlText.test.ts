import { expect, test } from "vitest";
import { decodeEntities } from "../src/sources/htmlText.js";

test("named and numeric entities are decoded once", () => {
    expect(decodeEntities("&lt;p&gt;a &amp;lt;b&amp;gt; &#x41;&#66;&nbsp;&quot;&apos;&lt;/p&gt;")).toBe("<p>a &lt;b&gt; AB \"'</p>");
});

test("unknown or out-of-range entities are left as written", () => {
    expect(decodeEntities("&bogus; &#99999999;")).toBe("&bogus; &#99999999;");
});
