import { expect, test } from "vitest";
import { locationLabel, osFrom, roundedPosition } from "../src/accounts/device.js";
import { displayIp } from "../src/web/security/clientAddress.js";

const UA = {
    mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    android: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
    linux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    chromeos: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

test("the operating system comes from the browser's platform hint when it sends one, else from its user agent", () => {
    expect([osFrom('"Linux"', UA.windows), osFrom('"macOS"', null), osFrom('"Chrome OS"', null)]).toEqual(["Linux", "macOS", "ChromeOS"]);
    expect([UA.mac, UA.windows, UA.iphone, UA.android, UA.linux, UA.chromeos].map((agent) => osFrom(null, agent))).toEqual(["macOS", "Windows", "iOS", "Android", "Linux", "ChromeOS"]);
    expect([osFrom(null, null), osFrom(null, "curl/8.5.0"), osFrom('"<script>"', null)]).toEqual(["Unknown", "Unknown", "Unknown"]);
});

test("the IP shown is the trusted proxies' client, or with none the address the server saw, and only ever a real address", () => {
    expect(displayIp("203.0.113.9", 0)).toBe("203.0.113.9");
    expect(displayIp("1.1.1.1, 203.0.113.9", 1)).toBe("203.0.113.9");
    expect([displayIp(null, 0), displayIp("x<script>", 0), displayIp("not, an, ip", 1)]).toEqual([null, null, null]);
});

test("the browser's position is kept only as a valid one rounded to about 10 km", () => {
    expect(roundedPosition("47.6062", "-122.3321")).toEqual({ lat: 47.6, lng: -122.3 });
    const invalid: Array<[string | null, string | null]> = [["91", "0"], ["0", "181"], ["abc", "1"], ["", ""], [null, null]];
    for (const [lat, lng] of invalid) expect(roundedPosition(lat, lng)).toBeNull();
});

test("the location is the browser's rounded position when shared, else Local network for a LAN address, else the IP's city, region and country", () => {
    const lookup = (ip: string) => (ip === "8.8.8.8" ? { city: "Seattle", region: "WA", country: "US" } : null);
    expect(locationLabel({ position: { lat: 47.6, lng: -122.3 }, ip: "8.8.8.8" }, lookup)).toBe("47.6, -122.3 (from your browser)");
    expect([locationLabel({ position: null, ip: "192.168.1.20" }, lookup), locationLabel({ position: null, ip: "10.0.0.2" }, lookup), locationLabel({ position: null, ip: "::1" }, lookup)]).toEqual(["Local network", "Local network", "Local network"]);
    expect(locationLabel({ position: null, ip: "8.8.8.8" }, lookup)).toBe("Seattle, WA, US");
    expect([locationLabel({ position: null, ip: "203.0.113.9" }, lookup), locationLabel({ position: null, ip: null }, lookup)]).toEqual(["Unknown", null]);
});
