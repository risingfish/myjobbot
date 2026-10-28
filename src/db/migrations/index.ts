import type { Migration } from "kysely/migration";
import { initial } from "./001_initial.js";
import { gmail } from "./002_gmail.js";
import { gmailAlerts } from "./003_gmail_alerts.js";
import { careersLookup } from "./004_careers_lookup.js";
import { pageSources } from "./005_page_sources.js";
import { injectionFlag } from "./006_injection_flag.js";
import { descriptionFormat } from "./007_description_format.js";
import { applied } from "./008_applied.js";
import { companies } from "./009_companies.js";
import { foldCareersPages } from "./010_fold_careers_pages.js";
import { userSettings } from "./011_user_settings.js";
import { userSources } from "./012_user_sources.js";

export const MIGRATIONS: Record<string, Migration> = { "001_initial": initial, "002_gmail": gmail, "003_gmail_alerts": gmailAlerts, "004_careers_lookup": careersLookup, "005_page_sources": pageSources, "006_injection_flag": injectionFlag, "007_description_format": descriptionFormat, "008_applied": applied, "009_companies": companies, "010_fold_careers_pages": foldCareersPages, "011_user_settings": userSettings, "012_user_sources": userSources };
