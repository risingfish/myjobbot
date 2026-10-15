import type { Migration } from "kysely/migration";
import { initial } from "./001_initial.js";
import { gmail } from "./002_gmail.js";

export const MIGRATIONS: Record<string, Migration> = { "001_initial": initial, "002_gmail": gmail };
