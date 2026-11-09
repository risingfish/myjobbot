import { expect, test } from "vitest";
import { noticeLines } from "../src/web/settingsNoticeLines.js";

test("each kind of settings notice is worded as before: a whole fallback, a left-out entry or key, retired keys, and search settings left in config.json", () => {
    expect([noticeLines({ kind: "fallback", setting: "match_threshold", reason: "too big" }), noticeLines({ kind: "fallback", setting: "title_filter.include[2]", reason: "too long" }), noticeLines({ kind: "fallback", setting: "nonsense", reason: "not a search setting" }), noticeLines({ kind: "retired", keys: ["boards", "searches"] }), noticeLines({ kind: "file_ignored", keys: ["preferences", "match_threshold"] })]).toEqual([["match_threshold fell back to its default: too big"], ["title_filter.include[2] was left out: too long"], ["nonsense was left out: not a search setting"], ["Company boards and saved searches are now saved sources, so boards and searches in config.json or the stored settings are no longer used. They can be removed."], ["config.json still holds search settings (preferences, match_threshold), which are no longer used. They can be removed from the file."]]);
});
