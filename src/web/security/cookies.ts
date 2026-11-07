export interface CookieSpec {
    name: string;
    options: { httpOnly: true; secure: boolean; path: "/"; sameSite: "lax" | "strict" };
}

/** Returns the sign-in and forgery cookies' names and settings: host-only and secure over HTTPS, plain on localhost over HTTP. */
export function cookieOptions(baseUrl: URL): { session: CookieSpec; csrf: CookieSpec } {
    const secure = baseUrl.protocol === "https:";
    const prefix = secure ? "__Host-" : "";
    return {
        session: { name: `${prefix}myjobbot_session`, options: { httpOnly: true, secure, path: "/", sameSite: "lax" } },
        csrf: { name: `${prefix}myjobbot_csrf`, options: { httpOnly: true, secure, path: "/", sameSite: "strict" } },
    };
}
