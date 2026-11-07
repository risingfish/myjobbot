import { expect, test } from "vitest";
import { parseLinkFragment } from "../src/web/linkFragment.js";

const TOKEN = "a".repeat(43);

test("an emailed link's fragment gives its purpose and token, and anything else gives nothing", () => {
    expect(parseLinkFragment(`#p=signin&t=${TOKEN}`)).toEqual({ purpose: "signin", token: TOKEN });
    expect(parseLinkFragment(`#p=step_up&t=${TOKEN}`)).toEqual({ purpose: "step_up", token: TOKEN });
    for (const hash of ["", "#", `#p=admin&t=${TOKEN}`, "#p=signin&t=short", `#p=reset&t=${TOKEN}<`]) expect(parseLinkFragment(hash)).toBeNull();
});
