import { expect, test } from "vitest";
import { matchingLines, sourceFiles } from "./helpers/sourceScan.js";

const KIND_COMPARISON = /[!=]==\s*"(password|email_link|authenticator|hardware_key|recovery_code)"|"(password|email_link|authenticator|hardware_key|recovery_code)"\s*[!=]==/;

const ALLOWED = [/^src\/accounts\/ways\//, /^src\/db\//, /^web\/components\/account\/(PasswordControls|EmailLinkControls|AuthenticatorControls|KeyControls|RecoveryCodes)\.tsx$/];

test("a way's kind is compared by name only inside the way modules, their controls and the stores", () => {
    const scanned = [...sourceFiles("src"), ...sourceFiles("web")].filter((path) => !ALLOWED.some((allowed) => allowed.test(path)));
    expect(matchingLines(scanned, KIND_COMPARISON)).toEqual([]);
});
