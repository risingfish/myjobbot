import type { Account } from "../../db/accountStore.js";
import type { AuthContext } from "../flows/context.js";
import { authenticatorWay } from "./authenticator.js";
import type { ChoiceKind } from "./catalog.js";
import { hardwareKeyWay } from "./hardwareKey.js";
import { passwordWay } from "./password.js";
import { recoveryCodeWay } from "./recoveryCode.js";

export interface ProofFields {
    password?: string;
    code?: string;
    response?: unknown;
}

export interface ProofWay {
    kind: ChoiceKind;
    readProof(fields: ProofFields): ProofFields | null;
    matches(ctx: AuthContext, account: Account | null, proof: ProofFields, address: string): Promise<boolean>;
}

export const PROOF_WAYS: Record<ChoiceKind, ProofWay> = { password: passwordWay, authenticator: authenticatorWay, recovery_code: recoveryCodeWay, hardware_key: hardwareKeyWay };
