"use client";

/** Shows why a page failed to load, inside the usual header and footer. */
export default function ErrorPage({ error }: { error: Error }) {
  return <main aria-label="Error"><p className="error">{error.message}</p></main>;
}
