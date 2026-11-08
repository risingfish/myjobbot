import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { PlannedSource, SourcePlans } from "../sourcePlans.js";

export class KyselySourcePlans implements SourcePlans {
    constructor(private readonly db: Kysely<Database>) {}

    /** Lists every user's saved sources that are on, by module, so the budget rules can count the searches they share. */
    async sourcesOnForAll(): Promise<PlannedSource[]> {
        const rows = await this.db.selectFrom("user_sources").select(["user_id", "module"]).where("enabled", "=", 1).execute();
        return rows.map((row) => ({ userId: row.user_id, module: row.module }));
    }
}
