export interface HeaderOptions {
    https: boolean;
    dev: boolean;
    path: string;
}

/** Returns the content policy for one response, its scripts stamped with the nonce; development loosens it for the dev server's tools. */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
    const scripts = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`;
    const styles = dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`;
    return ["default-src 'self'", scripts, styles, "img-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'"].join("; ");
}

/** Returns the security headers every response carries, with the link page's own referrer and caching rules. */
export function securityHeaders(nonce: string, options: HeaderOptions): Record<string, string> {
    const link = options.path === "/link";
    const headers: Record<string, string> = {
        "Content-Security-Policy": contentSecurityPolicy(nonce, options.dev),
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": link ? "no-referrer" : "same-origin",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    };
    if (options.https) headers["Strict-Transport-Security"] = "max-age=31536000";
    if (link) headers["Cache-Control"] = "no-store";
    return headers;
}

/** Returns the request headers passed on to the app, carrying the response's content policy, where the app reads the nonce. */
export function forwardedHeaders(incoming: Headers, csp: string): Headers {
    const headers = new Headers(incoming);
    headers.set("content-security-policy", csp);
    return headers;
}
