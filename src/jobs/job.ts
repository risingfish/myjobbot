export const ATS_NAMES = ["greenhouse", "lever", "ashby"] as const;
export type Ats = (typeof ATS_NAMES)[number];

const MAX_DESCRIPTION_CHARS = 20_000;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_CHARS = 500;

export interface Job {
  ats: Ats | "jsearch";
  jobId: string;
  company: string;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  team: string | null;
  workplaceType: string | null;
  isRemote: boolean | null;
  compensation: string | null;
  postedAt: string | null;
  description: string | null;
  publisher: string | null;
  requirements: string[];
  skills: string[];
  preferredSkills: string[];
}

type JobCore = Pick<Job, "ats" | "jobId" | "company" | "title" | "url">;
type JobDetails = Omit<Job, keyof JobCore>;

const NO_DETAILS: JobDetails = {
  location: null,
  department: null,
  team: null,
  workplaceType: null,
  isRemote: null,
  compensation: null,
  postedAt: null,
  description: null,
  publisher: null,
  requirements: [],
  skills: [],
  preferredSkills: [],
};

/** Builds a complete Job from required identity fields plus optional details, filling gaps and capping sizes. */
export function makeJob(core: JobCore, details: Partial<JobDetails>): Job {
  const description = details.description?.slice(0, MAX_DESCRIPTION_CHARS) ?? null;
  const lists = { requirements: capList(details.requirements), skills: capList(details.skills), preferredSkills: capList(details.preferredSkills) };
  return { ...NO_DETAILS, ...details, ...core, description, ...lists };
}

/** Trims, drops blank entries from, and caps the length and count of a job's list field (e.g. skills). */
function capList(items: string[] = []): string[] {
  const entries = items.map((item) => item.trim()).filter((item) => item !== "");
  return entries.slice(0, MAX_LIST_ITEMS).map((item) => item.slice(0, MAX_LIST_ITEM_CHARS));
}
