/** Fetches a JSON API address, rejecting with the server's own error message when the request fails. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as T;
}

/** Reads the error message a failed API response carries, falling back to its status code. */
async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  const message = /^\{"error":(".*")\}$/.exec(text)?.[1];
  return message ? String(JSON.parse(message)) : `The server answered ${response.status}.`;
}
