import { workdayDetail, workdaySearch } from "./boardData.js";

export const WORKDAY_PARAMS = { host: "acme.wd5.myworkdayjobs.com", tenant: "acme", site: "Acme_Careers" };
export const WORKDAY_BASE = "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Acme_Careers";

export function workdaySite(paths: string[], html = "<p>Build APIs &amp; services.</p>") {
    const posts: unknown[] = [];
    const listed = paths.map((path, index) => ({ title: `Engineer ${index}`, path, location: "Remote" }));
    const http = {
        postJson: async (url: string, body: unknown) => {
            posts.push({ url, body });
            const { offset, limit } = body as { offset: number; limit: number };
            return workdaySearch(listed.slice(offset, offset + limit));
        },
        getJson: async (url: string) => workdayDetail(`Engineer at ${url.slice(WORKDAY_BASE.length)}`, html),
    };
    return { http, posts };
}

export function numbered(count: number) {
    return Array.from({ length: count }, (_, index) => `/job/Remote/Engineer_R${index}`);
}
