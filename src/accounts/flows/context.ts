import type { Stores } from "../../db/store.js";
import type { RandomBytes } from "../tokens.js";

export interface AuthContext {
    stores: Pick<Stores, "sessions" | "accounts" | "methods">;
    now: () => string;
    random: RandomBytes;
}
