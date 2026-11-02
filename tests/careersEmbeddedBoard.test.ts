import { expect, test } from "vitest";
import { embeddedBoard } from "../src/careers/embeddedBoard.js";

const GEM_API = "https://api.gem.com/job_board/v0/bigpanda/job_posts/";
const EMBED = `<iframe data-src="https://jobs.gem.com/bigpanda/ITEM_ID?embed=true"></iframe><script>var gemApi = "${GEM_API}";</script>`;

test("a careers page whose HTML names one job board, and links to none, is read from that board", () => {
    expect(embeddedBoard(EMBED, [{ text: "About us", url: "https://bigpanda.example/about" }])).toBe("https://jobs.gem.com/bigpanda");
});

test("a page that names no board, names two different boards, or already links to a board gives none", () => {
    const two = `${EMBED}<script>var other = "https://jobs.lever.co/acme";</script>`;
    expect([embeddedBoard("<p>Join us</p>", []), embeddedBoard(two, []), embeddedBoard(EMBED, [{ text: "Jobs", url: "https://jobs.gem.com/bigpanda" }])]).toEqual([null, null, null]);
});
