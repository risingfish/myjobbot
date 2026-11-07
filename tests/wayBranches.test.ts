import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const KIND_COMPARISON = /[!=]==\s*"(password|email_link|authenticator|hardware_key|recovery_code)"|"(password|email_link|authenticator|hardware_key|recovery_code)"\s*[!=]==/;

const ALLOWED = [/^src\/accounts\/ways\//, /^src\/db\//, /^web\/components\/account\/(PasswordControls|EmailLinkControls|AuthenticatorControls|KeyControls|RecoveryCodes)\.tsx$/];

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name.startsWith(".next") || entry.name === "node_modules" ? [] : sourceFiles(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

test("a way's kind is compared by name only inside the way modules, their controls and the stores", () => {
    const offending = [...sourceFiles("src"), ...sourceFiles("web")]
        .filter((path) => !ALLOWED.some((allowed) => allowed.test(path)))
        .flatMap((path) => readFileSync(path, "utf8").split("\n").flatMap((line, index) => (KIND_COMPARISON.test(line) ? [`${path}:${index + 1}`] : [])));
    expect(offending).toEqual([]);
});
