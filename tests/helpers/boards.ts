export function greenhouseBoard(titles: string[], firstPublished = "2026-09-01T00:00:00Z"): unknown {
  return {
    jobs: titles.map((title, index) => ({
      id: 1000 + index,
      title,
      absolute_url: `https://example.com/jobs/${1000 + index}`,
      location: { name: "Remote" },
      first_published: firstPublished,
    })),
  };
}
