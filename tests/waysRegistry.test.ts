import { expect, test } from "vitest";
import { CHOICE_KINDS } from "../src/accounts/ways/catalog.js";
import { PROOF_WAYS } from "../src/accounts/ways/registry.js";

test("every way you can choose has a proof way that reads its own field, and nothing without it", () => {
    const fields = { password: "pw", code: "123456", response: { id: "cred" } };
    expect(CHOICE_KINDS.map((kind) => PROOF_WAYS[kind].kind)).toEqual([...CHOICE_KINDS]);
    expect(CHOICE_KINDS.map((kind) => PROOF_WAYS[kind].readProof(fields))).toEqual([{ password: "pw" }, { code: "123456" }, { code: "123456" }, { response: { id: "cred" } }]);
    expect(CHOICE_KINDS.map((kind) => PROOF_WAYS[kind].readProof({}))).toEqual([null, null, null, null]);
});
