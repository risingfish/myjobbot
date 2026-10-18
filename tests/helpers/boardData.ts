interface Posting {
    title: string;
    location: string;
}

export function workdaySearch(postings: Array<Posting & { path: string }>) {
    return { total: postings.length, jobPostings: postings.map((posting) => ({ title: posting.title, externalPath: posting.path, locationsText: posting.location, postedOn: "Posted Today" })) };
}

export function workdayDetail(title: string, html: string) {
    return { jobPostingInfo: { title, jobDescription: html, location: "Remote", externalUrl: "https://acme.wd5.myworkdayjobs.com/Acme_Careers/job/x" } };
}

export function ashbyBoard(postings: Array<Posting & { id: string }>, slug = "Acme") {
    return { jobs: postings.map((posting) => ({ id: posting.id, title: posting.title, jobUrl: `https://jobs.ashbyhq.com/${slug}/${posting.id}`, location: posting.location, descriptionPlain: `${posting.title} builds APIs.`, isListed: true })) };
}

export function fakeBoardHttp(answers: Record<string, unknown>) {
    const calls: string[] = [];
    const answer = async (url: string) => {
        calls.push(url);
        if (!(url in answers)) throw new Error(`GET ${url} failed with HTTP 404`);
        return structuredClone(answers[url]);
    };
    return { calls, getJson: answer, postJson: answer };
}
