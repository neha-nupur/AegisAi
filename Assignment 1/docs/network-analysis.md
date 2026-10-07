# network-analysis.md

**Assignment 1, Task 2 — Reading a Real Page's Waterfall**

| | |
|---|---|
| **Course** | CS 543 — Web Services |
| **Project** | AegisAI — Enterprise AI Security & Governance Gateway |
| **Repository** | https://github.com/neha-nupur/AegisAi |
| **Page analysed** | https://github.com/neha-nupur/AegisAi |
| **Instrument** | DevTools → Network (same data read through the W3C Resource Timing API + the browser network log) |
| **Browser** | Chromium 130.0.6723.191 (Electron 33.4.11), macOS |
| **Protocol** | HTTP/2 (`h2`) over TLS |
| **Captured** | 7 October 2026 |

---

## 1. Method

The procedure is the one the task specifies:

1. Open DevTools → **Network**.
2. Tick **Disable cache**.
3. Reload the page.
4. Read the waterfall.

### How "Disable cache" was reproduced, and verified

The **Disable cache** checkbox has exactly one effect: while it is ticked the browser may not
satisfy any request from its HTTP cache, so every byte must come off the network. That condition
was reproduced by loading the page in a **private (incognito) session, whose HTTP cache starts
empty**, and then verified numerically rather than assumed:

> **0 of 174 requests were served from cache.**
> A cache hit is signatured by `transferSize === 0 && encodedBodySize > 0` — bytes decoded but
> nothing sent on the wire. That signature never occurred in the measurement below.

**Control (why the checkbox matters).** The same page reloaded in an ordinary, warm-cache
session satisfied **168 of its 176 subresource requests from the local cache** and moved only
**6,334 bytes** of subresource traffic instead of **2,083,843 bytes** — a **99.7 % reduction**
that has nothing to do with the server and everything to do with the cache. That is precisely
what *Disable cache* removes, and why the task asks for it: without it the waterfall measures
the disk, not the network.

### What was recorded

Every resource's `start` time, `duration`, `encodedBodySize`, `transferSize` and
`responseStatus`, taken from the Resource Timing API — the same table DevTools draws as the
waterfall — plus the browser's own network log for statuses Resource Timing does not expose.

**Measurement window:** navigation start → 8,000 ms, i.e. everything the initial page load
requested. (The page continues to fire analytics beacons afterwards; those are reported
separately in §6 and are excluded from the counts.)

The exact expression used:

```js
(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource').filter(r => r.startTime < 8000);
  const all = [{ n:'(document)', ty:'navigation', st:0, d:nav.duration,
                 s:nav.responseStatus, e:nav.encodedBodySize, t:nav.transferSize }]
    .concat(res.map(r => ({ n:r.name, ty:r.initiatorType, st:r.startTime, d:r.duration,
                            s:r.responseStatus, e:r.encodedBodySize, t:r.transferSize })));
  const sum = a => a.reduce((x, y) => x + y, 0);
  return {
    requestCount: all.length,
    totalEncodedBytes: sum(all.map(r => r.e)),   // page size
    totalTransferBytes: sum(all.map(r => r.t)),  // on the wire, incl. headers
    cacheHits: all.filter(r => r.t === 0 && r.e > 0).length,
    codes: all.reduce((m, r) => { const k = String(r.s || 'none');
                                  m[k] = (m[k] || 0) + 1; return m; }, {}),
    redirects: nav.redirectCount
  };
})()
```

---

## 2. The four answers

| Question | Answer |
|---|---|
| **Request count** | **174** (1 document + 173 subresources) |
| **Total page size** | **2,094,889 bytes** of encoded body — **≈ 2.00 MiB (2.09 MB)**; **2,146,489 bytes** travelled on the wire including headers |
| **Slowest resource** | `https://avatars.githubusercontent.com/u/110279038?s=60&v=4` — **75,003 ms**, and it **never completed** (0 bytes). See §5. |
| **3xx / 4xx seen** | **3xx: none** (`navigation.redirectCount === 0`, no resource returned a 3xx). **4xx: exactly one** — `GET /_global-navigation/payloads.json?…` → **404 Not Found**. See §6. |

---

## 3. Request count — 174

### By initiator type

| Initiator | Requests | Encoded bytes |
|---|---:|---:|
| `navigation` (the HTML document) | 1 | 62,346 |
| `other` (module scripts, dynamic imports) | 112 | 1,367,355 |
| `link` (stylesheets, preloads, manifest) | 27 | 299,168 |
| `script` (classic / deferred scripts) | 25 | 359,091 |
| `fetch` (XHR/fetch from the page) | 7 | 1,864 |
| `img` | 2 | 5,065 |
| **Total** | **174** | **2,094,889** |

### By host

| Host | Requests | Encoded bytes | Share of bytes |
|---|---:|---:|---:|
| `github.githubassets.com` | 163 | 2,030,205 | 96.9 % |
| `github.com` | 9 | 64,684 | 3.1 % |
| `avatars.githubusercontent.com` | 2 | 0 | 0.0 % |
| **Total** | **174** | **2,094,889** | **100 %** |

**Reading:** a single HTML document pulls in **173** further resources — an order of magnitude
more objects than bytes for code, and the page is served from only three hosts. This is the
shape of every modern site: the request *count*, not the document size, is what the client
pays for, which is exactly why HTTP/2 multiplexing (all of it over one `h2` connection, as
`nextHopProtocol` confirms) exists.

---

## 4. Total page size

| | Bytes | Human |
|---|---:|---|
| HTML document (encoded) | 62,346 | 60.9 KiB |
| All 174 resources (encoded body) | **2,094,889** | **2,045.8 KiB ≈ 2.00 MiB** |
| All 174 resources (on the wire, incl. headers) | **2,146,489** | **2,045.4 KiB ≈ 2.05 MiB** |

`encodedBodySize` is what the resource weighs *after* content-encoding, i.e. what actually
crosses the network; `transferSize` adds the response headers (51,600 bytes in total here,
roughly 300 bytes per response).

### Ten largest resources

| # | Resource | Encoded bytes |
|---:|---|---:|
| 1 | `code-view-0e2e78e9bb940b94.js` | 207,898 |
| 2 | `xc-3fd4a2e7dcbad8e2.js` | 200,026 |
| 3 | `primer-react-8503588299651923.js` | 121,721 |
| 4 | `react-core-cbaead6ed565f666.js` | 83,503 |
| 5 | `primer-react-brand-css.05b219cdb8e80c43.module.css` | 71,915 |
| 6 | `behaviors-e223b791d26bdafa.js` | 63,493 |
| 7 | `rwd-069fc3d9814ff9fe.js` | 62,029 |
| 8 | `react-dom-client-1b4a3ee065998cea.js` | 60,080 |
| 9 | `global-f65d5aef412a9712.css` | 40,721 |
| 10 | `react-reconciler-8e99e505c4429605.js` | 37,745 |

The five largest files are 684,143 bytes — **32.7 % of the entire page** — and all five are
`github.githubassets.com` bundles.

---

## 5. The single slowest resource — and why

### The answer: a request that never finishes

| | |
|---|---|
| **URL** | `https://avatars.githubusercontent.com/u/110279038?s=60&v=4` |
| **Type** | `link` (`<link rel="preload" as="image">`) |
| **Started** | 809 ms (the instant the HTML arrived) |
| **Duration** | **75,003 ms** |
| **Bytes transferred** | **0** |
| **Status** | **none** — `nextHopProtocol` is empty, so no connection was ever established |
| **Finished** | 75,812 ms, cancelled — not completed |

A second, identical hang follows it: `avatars.githubusercontent.com/u/110279038?s=64&v=4`
started at 4,808 ms and ran **71,256 ms** with 0 bytes.

**Root cause, verified independently of the browser.** Replaying the same URL from the shell:

```console
$ curl -sS --max-time 12 -o /dev/null -D - "https://avatars.githubusercontent.com/u/110279038?s=60&v=4"
curl: (28) Connection timed out after 12006 milliseconds
```

`avatars.githubusercontent.com` does not answer from this network. The browser opens the socket,
gets nothing, and waits. Those two images are the longest bars in the waterfall by three orders
of magnitude — **17× longer than the slowest request that actually succeeded** — and because
`window.onload` waits for pending images, they hold the `load` event hostage until they are
cancelled at **76,074 ms**.

This is the point of the exercise: the slowest bar was **not** the biggest file, not the API
call, and not the server's fault in any way the page owner can fix — it was a third-party host
that never answered.

### The slowest resource that *did* complete

| # | Resource | Duration | Start | End | Encoded bytes |
|---:|---|---:|---:|---:|---:|
| 1 | `fz-e662bc3745e171e7.js` | **4,370 ms** | 785 ms | 5,155 ms | 3,442 |
| 2 | `2d5-9abb2f6ba5c935d0.js` | 4,370 ms | 786 ms | 5,156 ms | 5,010 |
| 3 | `3d-7f22b36f29a9dd94.js` | 4,369 ms | 785 ms | 5,154 ms | 23,007 |
| 4 | `mrn-f4d8384558be674f.js` | 4,368 ms | 786 ms | 5,155 ms | 5,724 |
| 5 | `2l-e468179ba7123a2e.js` | 4,340 ms | 785 ms | 5,126 ms | 27,876 |
| 6 | `app-install-banner-partial-942939de95073771.js` | 4,315 ms | 785 ms | 5,100 ms | 4,037 |
| 7 | `24-b11e1c4108322883.js` | 4,313 ms | 786 ms | 5,099 ms | 3,581 |
| 8 | `ge-ca1c0ba8656f9680.js` | 4,312 ms | 787 ms | 5,099 ms | 3,545 |
| 9 | `dgq-ed7b363cfd524930.js` | 4,281 ms | 787 ms | 5,068 ms | 5,461 |
| 10 | `775-98cafb1821375f14.js` | 4,280 ms | 787 ms | 5,067 ms | 4,921 |

Note the near-tie: **fifteen files all start at 785–787 ms and all finish at ≈ 5,100 ms.**
Individually the slowest is `fz-e662bc3745e171e7.js` at 4,370 ms, but that number is an
artefact, not a property of the file — it weighs only 3,442 bytes. What is really happening is
that all fifteen are sharing a single HTTP/2 connection whose congestion window is still in
slow start; the first request pays the DNS + TCP + TLS cost and every concurrent request behind
it queues. **The bottleneck is the connection, not any individual resource.**

### Page timeline

| Time | Event |
|---:|---|
| 0 ms | Navigation starts |
| 809 ms | HTML document complete (62,346 bytes) |
| 756 ms | First asset burst: 19 stylesheets + vendor JavaScript |
| 1,431 ms | **First Paint / First Contentful Paint** |
| 4,219 ms | **DOMContentLoaded** |
| 4,581–5,201 ms | Lazy chunks and repository-specific `fetch` calls; the **404** lands at 5,201 ms |
| ≈ 5,155 ms | Slowest completed resource finishes |
| 76,074 ms | **`load` event** — delayed 71 s by the two hung avatar images |

---

## 6. Every 3xx and 4xx in the waterfall

### 3xx — none

`navigation.redirectCount === 0` (`redirectStart`/`redirectEnd` are both 0), and no subresource
reported a status in the 300–399 range. This page loads directly; there is no redirect hop to
follow.

### 4xx — exactly one, a real 404

```text
5,201 ms  GET https://github.com/_global-navigation/payloads.json
          ?can_toggle_site_admin_and_employee_status=0&is_admin_mode_on=0
           &is_ui_opted_out=0&show_ui_opt_out=0&v=5
          → 404 Not Found   (52-byte body, 352 bytes on the wire, 22 ms)
```

GitHub's own page requests a navigation payload that does not exist for a signed-out visitor and
simply carries on — a **404 used as an ordinary, non-fatal outcome**, with a tiny typed JSON
body. It is the only failed request in the entire load.

### Status tally (174 requests in the window)

| Status | Count | Note |
|---|---:|---|
| `200 OK` | 171 | 170 confirmed by Resource Timing + 1 image whose status the network log shows as 200 |
| `404 Not Found` | 1 | `/_global-navigation/payloads.json` |
| *no status reported* | 2 | the two avatar requests that never connected |
| **Total** | **174** | |

### After the measurement window

The page keeps firing analytics pings once loaded, and the network log records them:

```text
GET  https://collector.github.com/github/collect        → 204 No Content   (Ping)
POST https://api.github.com/_private/browser/stats      → 200 OK           (Ping)
```

The **204** matters: it is a *success* with no body, not a failure. Teaching the difference
between "204 by design" and "a broken request" is the whole reason DevTools shows the status
column.

### Three requests that report no status

Resource Timing returned `responseStatus = 0` for three entries. They are **not** counted as
successes or failures:

| Resource | Bytes | Explanation |
|---|---:|---|
| `avatars.githubusercontent.com/u/110279038?s=60&v=4` | 0 | never connected (timed out) |
| `avatars.githubusercontent.com/u/110279038?s=64&v=4` | 0 | never connected (timed out) |
| `github.githubassets.com/images/gravatars/gravatar-user-420.png?size=40` | 5,065 | fully downloaded in 39 ms; the browser network log reports **200**, Resource Timing simply did not expose it |

---

## 7. What this tells AegisAI

AegisAI is a gateway: every request it forwards is somebody else's latency. Four findings above
translate directly into its contract.

1. **A hanging dependency is the real slowest resource, and it is not in your metrics.** The
   avatar host produced a 75-second bar and zero bytes. AegisAI's outbound client must therefore
   carry an **explicit timeout on every provider call** — never an unbounded socket — because
   the failure mode of "no response at all" is invisible in average-latency dashboards.
2. **Count and size are different budgets.** 174 requests moved only 2 MiB; the per-request
   overhead (≈ 300 bytes of headers each) is 51,600 bytes, ~2.5 % of the page. Rate limiting and
   idempotency in AegisAI must be keyed on **request count**, not bytes.
3. **A 404 with a 52-byte typed body is a feature.** GitHub's missing payload is a normal,
   recoverable outcome. AegisAI must answer a request for an unknown policy, model or trace the
   same way: **404 + a small machine-readable error**, never an HTML page or a 500.
4. **Cache and quota must be observable on the wire.** This page is only fast on a second visit
   because of `Cache-Control`; the warm reload moved 6,334 bytes instead of 2,083,843. AegisAI's
   `ETag` / `Cache-Control` / `RateLimit` headers are the same class of protocol signal and
   should be emitted, not merely logged.
