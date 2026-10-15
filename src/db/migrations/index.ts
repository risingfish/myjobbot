import type { Migration } from "kysely/migration";
import { initial } from "./001_initial.js";

export const MIGRATIONS: Record<string, Migration> = { "001_initial": initial };
