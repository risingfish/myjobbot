const WAIT_MS = 5000;

/** Asks the browser for its position, giving up after a few seconds or when it is refused. */
function currentPosition(): Promise<GeolocationPosition | null> {
    const geolocation = typeof navigator === "undefined" ? null : (navigator.geolocation ?? null);
    if (geolocation === null) return Promise.resolve(null);
    return new Promise((resolve) => geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: WAIT_MS, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }));
}

/** Adds the browser's position to a sign-in form when the account holder shares it; the server keeps it only rounded. */
export async function withPosition(form: FormData): Promise<FormData> {
    const position = await currentPosition();
    if (position !== null) {
        form.set("lat", String(position.coords.latitude));
        form.set("lng", String(position.coords.longitude));
    }
    return form;
}
