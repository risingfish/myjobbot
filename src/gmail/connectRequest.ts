const LOOPBACK = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i;

/** Tells whether Settings was opened on this machine's own address, the only kind Google will send the owner back to. */
export function isLoopbackHost(host: string): boolean {
    return LOOPBACK.test(host);
}
