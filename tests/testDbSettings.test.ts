import { expect, test } from "vitest";
import { parseDbSettings } from "../src/db/settings.js";
import { testEnvironment } from "./helpers/testDb.js";

const APP = { MYJOBBOT_DB_HOST: "app-host", MYJOBBOT_DB_NAME: "myjobbot_dev_alt", MYJOBBOT_DB_USER: "app-user", MYJOBBOT_DB_PASSWORD: "app-secret" };

test("the test database falls back to the app's connection settings and defaults its name", () => {
    expect(parseDbSettings(testEnvironment(APP))).toEqual({ host: "app-host", port: 3306, database: "myjobbot_test", user: "app-user", password: "app-secret" });
});

test("each MYJOBBOT_TEST_DB_* setting replaces its app setting for the tests only", () => {
    const env = { ...APP, MYJOBBOT_TEST_DB_HOST: "test-host", MYJOBBOT_TEST_DB_PORT: "3307", MYJOBBOT_TEST_DB_NAME: "myjobbot_test_alt", MYJOBBOT_TEST_DB_USER: "test-user", MYJOBBOT_TEST_DB_PASSWORD: "test-secret" };
    expect(parseDbSettings(testEnvironment(env))).toEqual({ host: "test-host", port: 3307, database: "myjobbot_test_alt", user: "test-user", password: "test-secret" });
    expect(parseDbSettings(testEnvironment({ ...APP, MYJOBBOT_TEST_DB_USER: "test-user" }))).toMatchObject({ host: "app-host", user: "test-user", password: "app-secret" });
});

test("a test database is accepted only when _test is a whole part of its name", () => {
    expect(testEnvironment({ ...APP, MYJOBBOT_TEST_DB_NAME: "myjobbot_test_alt" }).MYJOBBOT_DB_NAME).toBe("myjobbot_test_alt");
    for (const name of ["myjobbot_dev_alt", "myjobbot", "myjobbot_testing", "myjobbot_contest"]) {
        expect(() => testEnvironment({ ...APP, MYJOBBOT_TEST_DB_NAME: name })).toThrow(`refusing to run tests against ${name}`);
    }
});
