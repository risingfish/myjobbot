export const ATS_NAMES = ["greenhouse", "lever", "ashby"] as const;
export type Ats = (typeof ATS_NAMES)[number];

const MAX_DESCRIPTION_CHARS = 20_000;

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
};

export function makeJob(core: JobCore, details: Partial<JobDetails>): Job {
  const description = details.description?.slice(0, MAX_DESCRIPTION_CHARS) ?? null;
  return { ...NO_DETAILS, ...details, ...core, description };
}
