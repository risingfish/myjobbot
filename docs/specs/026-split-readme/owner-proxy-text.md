# Owner's text: proxies and the sign-in limits

Supplied by the owner on 2026-11-07 for spec FR-015. Use it as given (T011, T012).

## The paragraph (for `docs/deploying.md`, "Proxies and the sign-in limits")

**Proxies and the sign-in limits.** The per-address sign-in limits count each client by its IP
address, which the web app reads from `X-Forwarded-For`. Each proxy in front of the pod appends
the address it received the request from, and anyone can send a header of their own, so the app
trusts only the entries its own proxies added: it takes the address `web.trustedProxies` places
from the right. Left empty, the chart uses 1 with the ingress (the ingress controller alone) and 0
without. Count every proxy that appends to `X-Forwarded-For`, the ingress included: Cloudflare or a
cloud load balancer in HTTP mode in front of the ingress makes 2, while a TCP pass-through such as
MetalLB adds nothing. Too high, and a client can name any address it likes, dodging the
per-address limit; too low, and many clients share one address and one limit. To check it, sign
in and open the Account tab's Sign-ins list: it should show your real public IP, not the
ingress's or a pod's.

## The `values.yaml` comment (for `web.trustedProxies`)

```yaml
    # How many proxies in front of the web pod append to X-Forwarded-For, the ingress included. The
    # sign-in limits count clients by the address this many entries from the right. Empty: 1 with
    # the ingress, 0 without. Add one for each extra appending proxy (Cloudflare, an HTTP-mode load
    # balancer); a TCP pass-through (MetalLB) adds none. Too high lets a client forge its address;
    # too low makes clients share one limit. Check: the Account tab's Sign-ins list shows your IP.
    trustedProxies: ""
```

## Why it's important (for "Why the count matters")

- Too high is a security hole. Each sign-in failure is counted twice: once against the email and
  once against the client's address. If the count is higher than the real number of proxies, the
  app reads an entry the client wrote itself. Someone guessing passwords can then send a different
  made-up address each time, and the per-address limit never catches them. That limit is the
  defence against one client trying many accounts. The per-email limit still applies, but it only
  protects one account at a time.
- Too low locks out real users. The app reads a proxy's own address instead of the visitor's, so
  everyone behind that proxy shares one limit. One person, or one attacker, failing 20 sign-ins in
  15 minutes would block sign-in for everyone, and you'd see it as unexplained lockouts.
- The default is only a guess. The chart sets 1 whenever the ingress is on, which assumes nothing
  else sits in front of it. Your cluster is the one place that's known, which is why the docs
  should say how to count proxies and how to check the result.
- The check is cheap. The Sign-ins list on the Account tab shows the IP the app worked out. If it
  shows your real public address after a production sign-in, the setting is right.

## Caveat to add (research R6b)

The last point overstates the check, as the code behaves (`src/web/security/clientAddress.ts`):
with a count too high, or 0, the Sign-ins list shows the leftmost `X-Forwarded-For` entry, which is
the visitor's real address unless the client wrote the header itself. A correct-looking list
proves only that a count of 1 or more isn't too low. The page adds one sentence saying so, after the
owner's points, without changing them.
