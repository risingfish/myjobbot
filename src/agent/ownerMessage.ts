import type { AppConfig } from "../config/load.js";
import { READS_PROFILE } from "../config/schema.js";
import { SKILL_GROUPS, type ProfileContent } from "../db/resumeStore.js";
import { scrubText, type DataMarkers } from "./markers.js";

const GROUP_NAMES = { engineering: "Engineering", people: "People", project: "Project" } as const;

/** Builds the first user message of every scoring path: what the model reads about the owner, chosen by resume_view, inside the data markers, then the closing request. */
export function ownerMessage(config: Pick<AppConfig, "resume" | "profile" | "settings">, markers: DataMarkers, closing: string): string {
    const view = config.profile === null ? "resume" : config.settings.resume_view;
    if (!READS_PROFILE[view] || config.profile === null) return framed("My resume, between the data markers:", config.resume, { markers, closing });
    if (view === "resume_and_profile") return framed("My resume, between the data markers:", `${config.resume}\n\n${lookFor(config.profile)}`, { markers, closing });
    return framed("My resume isn't included; judge fit with it from this profile, between the data markers:", `${config.profile.summary}\n\n${lookFor(config.profile)}`, { markers, closing });
}

/** Lists the profile's skills by group as what to look for in a job posting. */
function lookFor(profile: ProfileContent): string {
    const lines = SKILL_GROUPS.map(
        (group) =>
            `${GROUP_NAMES[group]}: ${
                profile.skills
                    .filter((skill) => skill.group === group)
                    .map((skill) => skill.name)
                    .join(", ") || "(none)"
            }`,
    );
    return ["What to look for in a job posting, from my resume:", ...lines].join("\n");
}

/** Puts text from a file or the model inside the markers, scrubbed of look-alike markers first, between an opening line and the closing request. */
function framed(opening: string, data: string, { markers, closing }: { markers: DataMarkers; closing: string }): string {
    return `${opening}\n\n${markers.open}\n${scrubText(data).text}\n${markers.close}\n\n${closing}`;
}
