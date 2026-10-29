export class HttpStatusError extends Error {
    /** Reports a request the server answered with a failing status, keeping the status so the failure can be named. */
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "HttpStatusError";
    }
}

export class NetworkError extends Error {
    /** Reports a request that never got an answer: the connection failed or timed out. */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "NetworkError";
    }
}
