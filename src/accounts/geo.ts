import geoip from "geoip-lite";
import type { Place } from "./device.js";

/** Looks an IP address up in geoip-lite's bundled data, giving its city, region and country, or null when it isn't listed. */
export function lookUpPlace(ip: string): Place | null {
    // geoip-lite's bundled data for now; a MaxMind GeoLite2-City file read with the `maxmind` package is the other option (fresher, needs a free licence key and a monthly download).
    const found = geoip.lookup(ip);
    return found === null ? null : { city: found.city, region: found.region, country: found.country };
}
