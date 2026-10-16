import { expect, test } from "vitest";
import { allowedUrl, isPublicAddress } from "../src/careers/addresses.js";

const PRIVATE = ["0.0.0.0", "0.1.2.3", "127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.3.10", "169.254.1.1", "100.64.0.1", "224.0.0.1", "::", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"];

test("isPublicAddress refuses local, private, link-local, CGNAT, multicast and mapped addresses, and accepts public ones", () => {
    for (const ip of PRIVATE) expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "::ffff:93.184.216.34"]) expect(isPublicAddress(ip), ip).toBe(true);
    expect(isPublicAddress("not-an-ip")).toBe(false);
});

test("allowedUrl refuses schemes other than http and https", () => {
    for (const url of ["ftp://acme.example/", "file:///etc/passwd", "javascript:alert(1)", "not a url"]) expect(allowedUrl(url), url).toBe(false);
});

test("allowedUrl refuses ports other than the default ones, and credentials", () => {
    expect(allowedUrl("https://acme.example:8443/careers")).toBe(false);
    expect(allowedUrl("http://acme.example:3306/")).toBe(false);
    expect(allowedUrl("https://user:pass@acme.example/")).toBe(false);
});

test("allowedUrl accepts plain http and https addresses", () => {
    expect(allowedUrl("https://acme.example/careers")).toBe(true);
    expect(allowedUrl("http://acme.example:80/jobs")).toBe(true);
});
