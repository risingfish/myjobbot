import { expect, test } from "vitest";
import { describeConnectionError, parseDbSettings } from "../src/db/settings.js";

const SECRET = "s3cret-sentinel";
const FULL = { MYJOBBOT_DB_HOST: "192.168.3.10", MYJOBBOT_DB_USER: "myjobbot", MYJOBBOT_DB_PASSWORD: SECRET };

function errorOf(run: () => unknown): string {
    try {
        run();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error("expected an error");
}

test("settings default the port and database name", () => {
    expect(parseDbSettings(FULL)).toEqual({ host: "192.168.3.10", port: 3306, database: "myjobbot", user: "myjobbot", password: SECRET });
    expect(parseDbSettings({ ...FULL, MYJOBBOT_DB_PORT: "3307", MYJOBBOT_DB_NAME: "myjobbot_test" })).toMatchObject({ port: 3307, database: "myjobbot_test" });
});

test("a missing setting is named, and the password never appears in an error", () => {
    for (const name of ["MYJOBBOT_DB_HOST", "MYJOBBOT_DB_USER", "MYJOBBOT_DB_PASSWORD"] as const) {
        const message = errorOf(() => parseDbSettings({ ...FULL, [name]: undefined }));
        expect(message).toContain(`${name} is not set`);
        expect(message).not.toContain(SECRET);
    }
    const badPort = errorOf(() => parseDbSettings({ ...FULL, MYJOBBOT_DB_PORT: "not-a-port" }));
    expect(badPort).toContain("MYJOBBOT_DB_PORT is invalid");
    expect(badPort).not.toContain(SECRET);
});

test("connection errors say what went wrong without the password", () => {
    const settings = parseDbSettings(FULL);
    const denied = describeConnectionError(Object.assign(new Error(`Access denied (${SECRET})`), { code: "ER_ACCESS_DENIED_ERROR" }), settings);
    expect(denied.message).toBe("MariaDB at 192.168.3.10:3306 rejected user myjobbot");
    for (const code of ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"]) {
        expect(describeConnectionError(Object.assign(new Error("x"), { code }), settings).message).toBe("can't reach MariaDB at 192.168.3.10:3306");
    }
    expect(describeConnectionError(new Error(`odd ${SECRET}`), settings).message).not.toContain(SECRET);
});
