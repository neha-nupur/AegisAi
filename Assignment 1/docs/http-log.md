# http-log.md

**Assignment 1, Task 1 — HTTP by Hand**

| | |
|---|---|
| **Course** | CS 543 — Web Services |
| **Project** | AegisAI — Enterprise AI Security & Governance Gateway |
| **Repository** | https://github.com/neha-nupur/AegisAi |
| **Deliverable** | Five annotated request/response pairs, at least one a 404 (**six provided below**, one of them a deliberate 404) |
| **Tool** | `curl 8.7.1 (x86_64-apple-darwin25.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.68.0` |
| **Captured** | 07 October 2026 |

---

## Method

Every transcript below was produced with plain `curl -i`, exactly as the task requires: `-i` writes the **status line and all response headers into the same stream as the body**, so nothing is hidden by the client. To also capture what the *client* put on the wire, each run added `-v` (verbose) and `-o <file>`, which splits the two directions without altering a single byte of either:

```bash
curl -i -sS -v -o <response-file> <URL> 2> <trace-file>
#   -i  include response headers in the output
#   -s  silent progress meter   -S  still show errors
#   -v  verbose: emit the outgoing request to stderr
#   -o  write status line + headers + body to a file
```

### The API chosen

All six requests target the **GitHub REST API v3** (`api.github.com`), which satisfies every constraint of the task:

- **Public** — reachable without an account or an API key.
- **Read-only** — every request here is `GET`; nothing on the server is created, changed or destroyed by any of them.
- **JSON** — the success *and* failure bodies are `application/json; charset=utf-8`.
- **Real** — it returns genuine `etag`, `link`, `x-ratelimit-*` and security headers, which is what makes it worth reading line by line.

It is also thematically adjacent to AegisAI: it is the kind of third-party API the gateway would sit in front of.

### Anatomy of every response

```text
HTTP/2 200                     <- status line: version, code, (reason phrase on HTTP/1.1)
content-type: application/json; charset=utf-8
... more header fields ...     <- each is `name: value` terminated by CRLF
<CR><LF>                       <- empty line: headers end, body begins
{ ... }                        <- body (the entity)
```

Two facts worth stating once, because the rest of this document assumes them:

1. Every line of an HTTP/1.x message is terminated by **CRLF** (`\r\n`), including the    last header, and the blank line separating headers from body is an *empty* CRLF pair.    The captures below are byte-faithful, so the `\r` is still present in the files.
2. Under **HTTP/2** the status line reads `HTTP/2 200` with *no* reason phrase. HTTP/2    frames the same information binary-side, so `200`, `404` and `301` below are the whole    story. Request 6, fetched over plaintext HTTP/1.1, shows the familiar    `301 Moved Permanently` form for contrast.

---

## 1. Fetching a resource — repository metadata

### Request

```bash
curl -i -sS "https://api.github.com/repos/neha-nupur/AegisAi"
```

As sent on the wire (from `curl -v`):

```http
 GET /repos/neha-nupur/AegisAi HTTP/2
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/2 200 
date: Wed, 07 Oct 2026 18:04:52 GMT
cache-control: public, max-age=60, s-maxage=60
vary: Accept,Accept-Encoding, Accept, X-Requested-With
last-modified: Tue, 08 Sep 2026 17:25:56 GMT
x-github-api-version-selected: 2022-11-28
access-control-expose-headers: ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset, Warning
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
server: github.com
content-type: application/json; charset=utf-8
x-github-media-type: github.v3; format=json
etag: W/"369b09c236441bdee9fb442ddde39baebe307f63a3d1d15b1fe3433b230428fb"
accept-ranges: bytes
x-ratelimit-limit: 60
x-ratelimit-remaining: 50
x-ratelimit-used: 10
x-ratelimit-resource: core
x-ratelimit-reset: 1791399491
content-length: 5820
x-github-request-id: C264:1CD6F9:10CBFF:120E42:6AC689C4
x-github-edge-region: centralindia

{
  "id": 1345756839,
  "node_id": "R_kgDOUDaepw",
  "name": "AegisAi",
  "full_name": "neha-nupur/AegisAi",
  "private": false,
  "owner": {
    "login": "neha-nupur",
    "id": 110279038,
    "node_id": "U_kgDOBpK5fg",
    "avatar_url": "https://avatars.githubusercontent.com/u/110279038?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/neha-nupur",
    "html_url": "https://github.com/neha-nupur",
    "followers_url": "https://api.github.com/users/neha-nupur/followers",
    "following_url": "https://api.github.com/users/neha-nupur/following{/other_user}",
    "gists_url": "https://api.github.com/users/neha-nupur/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/neha-nupur/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/neha-nupur/subscriptions",
    "organizations_url": "https://api.github.com/users/neha-nupur/orgs",
    "repos_url": "https://api.github.com/users/neha-nupur/repos",
    "events_url": "https://api.github.com/users/neha-nupur/events{/privacy}",
    "received_events_url": "https://api.github.com/users/neha-nupur/received_events",
    "type": "User",
    "user_view_type": "public",
    "site_admin": false
  },
  "html_url": "https://github.com/neha-nupur/AegisAi",
  "description": "AegisAI is an Enterprise AI Security & Governance Gateway that acts as a secure control plane between enterprise applications or AI agents and AI model providers. It provides centralized authentication, privacy scanning, policy enforcement, model routing, approval workflows, rate limiting, reliability mechanisms, and auditability.",
  "fork": false,
  "url": "https://api.github.com/repos/neha-nupur/AegisAi",
  "forks_url": "https://api.github.com/repos/neha-nupur/AegisAi/forks",
  "keys_url": "https://api.github.com/repos/neha-nupur/AegisAi/keys{/key_id}",
  "collaborators_url": "https://api.github.com/repos/neha-nupur/AegisAi/collaborators{/collaborator}",
  "teams_url": "https://api.github.com/repos/neha-nupur/AegisAi/teams",
  "hooks_url": "https://api.github.com/repos/neha-nupur/AegisAi/hooks",
  "issue_events_url": "https://api.github.com/repos/neha-nupur/AegisAi/issues/events{/number}",
  "events_url": "https://api.github.com/repos/neha-nupur/AegisAi/events",
  "assignees_url": "https://api.github.com/repos/neha-nupur/AegisAi/assignees{/user}",
  "branches_url": "https://api.github.com/repos/neha-nupur/AegisAi/branches{/branch}",
  "tags_url": "https://api.github.com/repos/neha-nupur/AegisAi/tags",
  "blobs_url": "https://api.github.com/repos/neha-nupur/AegisAi/git/blobs{/sha}",
  "git_tags_url": "https://api.github.com/repos/neha-nupur/AegisAi/git/tags{/sha}",
  "git_refs_url": "https://api.github.com/repos/neha-nupur/AegisAi/git/refs{/sha}",
  "trees_url": "https://api.github.com/repos/neha-nupur/AegisAi/git/trees{/sha}",
  "statuses_url": "https://api.github.com/repos/neha-nupur/AegisAi/statuses/{sha}",
  "languages_url": "https://api.github.com/repos/neha-nupur/AegisAi/languages",
  "stargazers_url": "https://api.github.com/repos/neha-nupur/AegisAi/stargazers",
  "contributors_url": "https://api.github.com/repos/neha-nupur/AegisAi/contributors",
  "subscribers_url": "https://api.github.com/repos/neha-nupur/AegisAi/subscribers",
  "subscription_url": "https://api.github.com/repos/neha-nupur/AegisAi/subscription",
  "commits_url": "https://api.github.com/repos/neha-nupur/AegisAi/commits{/sha}",
  "git_commits_url": "https://api.github.com/repos/neha-nupur/AegisAi/git/commits{/sha}",
  "comments_url": "https://api.github.com/repos/neha-nupur/AegisAi/comments{/number}",
  "issue_comment_url": "https://api.github.com/repos/neha-nupur/AegisAi/issues/comments{/number}",
  "contents_url": "https://api.github.com/repos/neha-nupur/AegisAi/contents/{+path}",
  "compare_url": "https://api.github.com/repos/neha-nupur/AegisAi/compare/{base}...{head}",
  "merges_url": "https://api.github.com/repos/neha-nupur/AegisAi/merges",
  "archive_url": "https://api.github.com/repos/neha-nupur/AegisAi/{archive_format}{/ref}",
  "downloads_url": "https://api.github.com/repos/neha-nupur/AegisAi/downloads",
  "issues_url": "https://api.github.com/repos/neha-nupur/AegisAi/issues{/number}",
  "pulls_url": "https://api.github.com/repos/neha-nupur/AegisAi/pulls{/number}",
  "milestones_url": "https://api.github.com/repos/neha-nupur/AegisAi/milestones{/number}",
  "notifications_url": "https://api.github.com/repos/neha-nupur/AegisAi/notifications{?since,all,participating}",
  "labels_url": "https://api.github.com/repos/neha-nupur/AegisAi/labels{/name}",
  "releases_url": "https://api.github.com/repos/neha-nupur/AegisAi/releases{/id}",
  "deployments_url": "https://api.github.com/repos/neha-nupur/AegisAi/deployments",
  "created_at": "2026-08-25T06:16:34Z",
  "updated_at": "2026-09-08T17:25:56Z",
  "pushed_at": "2026-09-06T05:22:53Z",
  "git_url": "git://github.com/neha-nupur/AegisAi.git",
  "ssh_url": "git@github.com:neha-nupur/AegisAi.git",
  "clone_url": "https://github.com/neha-nupur/AegisAi.git",
  "svn_url": "https://github.com/neha-nupur/AegisAi",
  "homepage": "",
  "size": 1261,
  "stargazers_count": 1,
  "watchers_count": 1,
  "language": "Python",
  "has_issues": true,
  "has_projects": true,
  "has_downloads": false,
  "has_wiki": true,
  "has_pages": false,
  "has_discussions": false,
  "forks_count": 1,
  "mirror_url": null,
  "archived": false,
  "disabled": false,
  "open_issues_count": 0,
  "license": null,
  "allow_forking": true,
  "is_template": false,
  "web_commit_signoff_required": false,
  "has_pull_requests": true,
  "pull_request_creation_policy": "all",
  "topics": [

  ],
  "visibility": "public",
  "forks": 1,
  "open_issues": 0,
  "watchers": 1,
  "default_branch": "main",
  "temp_clone_token": null,
  "network_count": 1,
  "subscribers_count": 0
}
```

### Annotation

- **Status code** — **200 OK** — the server understood the request and returned the current representation of the repository. A GET is safe and idempotent, so this response may be cached and replayed without side effects.
- **Content-Type** — **application/json; charset=utf-8** — the body is JSON serialised in UTF-8, so a client must decode it with a JSON parser; the charset removes any ambiguity about how the octets map to characters.
- Note the caching and validation headers: `cache-control: public, max-age=60`, `etag: W/"369b09…"` and `last-modified`. Together they let a client revalidate with `If-None-Match` and receive **304 Not Modified** instead of re-downloading 5,820 bytes. `x-ratelimit-*` reports the unauthenticated quota (60 requests/hour, 50 still available).

---

## 2. Fetching a collection with a query string — one commit

### Request

```bash
curl -i -sS "https://api.github.com/repos/neha-nupur/AegisAi/commits?per_page=1"
```

As sent on the wire (from `curl -v`):

```http
 GET /repos/neha-nupur/AegisAi/commits?per_page=1 HTTP/2
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/2 200 
date: Wed, 07 Oct 2026 18:04:53 GMT
cache-control: public, max-age=60, s-maxage=60
vary: Accept,Accept-Encoding, Accept, X-Requested-With
last-modified: Sun, 06 Sep 2026 05:22:38 GMT
x-github-api-version-selected: 2022-11-28
access-control-expose-headers: ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset, Warning
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
server: github.com
content-type: application/json; charset=utf-8
x-github-media-type: github.v3; format=json
link: <https://api.github.com/repositories/1345756839/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1345756839/commits?per_page=1&page=6>; rel="last"
etag: W/"2bc7b62d33a103a97b3ad382335a8fb0eed7411d7caca9e344a4bcaeb25444bf"
accept-ranges: bytes
x-ratelimit-limit: 60
x-ratelimit-remaining: 49
x-ratelimit-used: 11
x-ratelimit-resource: core
x-ratelimit-reset: 1791399491
content-length: 1747
x-github-request-id: C265:5D67:107425:11B4A8:6AC689C5
x-github-edge-region: centralindia

[
  {
    "sha": "c9d8a356cfb444ee20f9a0f6f83a26bb4a113c35",
    "node_id": "C_kwDOUDaep9oAKGM5ZDhhMzU2Y2ZiNDQ0ZWUyMGY5YTBmNmY4M2EyNmJiNGExMTNjMzU",
    "commit": {
      "author": {
        "name": "nehaN",
        "email": "nehanupur497@gmail.com",
        "date": "2026-09-06T05:22:38Z"
      },
      "committer": {
        "name": "nehaN",
        "email": "nehanupur497@gmail.com",
        "date": "2026-09-06T05:22:38Z"
      },
      "message": "Added Assignment 4 similar to Assignment 4 of CampusEats",
      "tree": {
        "sha": "c03fca0c23a1a6df4804ecb3fbb4f81ad5c93934",
        "url": "https://api.github.com/repos/neha-nupur/AegisAi/git/trees/c03fca0c23a1a6df4804ecb3fbb4f81ad5c93934"
      },
      "url": "https://api.github.com/repos/neha-nupur/AegisAi/git/commits/c9d8a356cfb444ee20f9a0f6f83a26bb4a113c35",
      "comment_count": 0,
      "verification": {
        "verified": false,
        "reason": "unsigned",
        "signature": null,
        "payload": null,
        "verified_at": null
      }
    },
    "url": "https://api.github.com/repos/neha-nupur/AegisAi/commits/c9d8a356cfb444ee20f9a0f6f83a26bb4a113c35",
    "html_url": "https://github.com/neha-nupur/AegisAi/commit/c9d8a356cfb444ee20f9a0f6f83a26bb4a113c35",
    "comments_url": "https://api.github.com/repos/neha-nupur/AegisAi/commits/c9d8a356cfb444ee20f9a0f6f83a26bb4a113c35/comments",
    "author": null,
    "committer": null,
    "parents": [
      {
        "sha": "c2cf183a2644f94606f20f99f6b7de1a7fcea20a",
        "url": "https://api.github.com/repos/neha-nupur/AegisAi/commits/c2cf183a2644f94606f20f99f6b7de1a7fcea20a",
        "html_url": "https://github.com/neha-nupur/AegisAi/commit/c2cf183a2644f94606f20f99f6b7de1a7fcea20a"
      }
    ]
  }
]
```

### Annotation

- **Status code** — **200 OK** — the query string `?per_page=1` is part of the request-target and selects a page size; the server still fulfilled the request normally and returned a JSON array (note the leading `[`).
- **Content-Type** — **application/json; charset=utf-8** — a JSON array of commit objects; identical media type to Request 1, which is what lets one generic client library handle every endpoint on this API.
- The `link` header carries RFC 8288 pagination — `<…page=2>; rel="next", <…page=6>; rel="last"`. This is how a REST API advertises navigation **without** inventing a body-level envelope: the client discovers `next` from a header rather than from a wrapper object. `x-ratelimit-remaining` has dropped from 50 to 49, so the quota is per-request observable.

---

## 3. A deliberately failing request — asking for something that does not exist

### Request

```bash
curl -i -sS "https://api.github.com/repos/neha-nupur/aegisai-does-not-exist"
```

As sent on the wire (from `curl -v`):

```http
 GET /repos/neha-nupur/aegisai-does-not-exist HTTP/2
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/2 404 
date: Wed, 07 Oct 2026 18:04:53 GMT
content-type: application/json; charset=utf-8
x-github-media-type: github.v3; format=json
x-github-api-version-selected: 2022-11-28
access-control-expose-headers: ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset, Warning
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
vary: Accept-Encoding, Accept, X-Requested-With
server: github.com
x-ratelimit-limit: 60
x-ratelimit-remaining: 48
x-ratelimit-used: 12
x-ratelimit-resource: core
x-ratelimit-reset: 1791399491
content-length: 132
x-github-request-id: C266:3467D3:66A17:6ED10:6AC689C5
x-github-edge-region: centralindia

{
  "message": "Not Found",
  "documentation_url": "https://docs.github.com/rest/repos/repos#get-a-repository",
  "status": "404"
}
```

### Annotation

- **Status code** — **404 Not Found** — the request was well-formed and the server understood it, but no such repository exists. This is the deliberate failure required by the task: it is a *client* error (4xx), not a server fault (5xx), and it is not 401/403 — permission was never the issue.
- **Content-Type** — **application/json; charset=utf-8** — the failure itself is machine-readable. A well-designed API returns a typed error body (`message`, `status`, `documentation_url`) instead of an HTML error page, so a client can branch on `status == "404"` rather than scraping text.
- This is exactly the behaviour AegisAI must reproduce: a request for a policy, model or trace that does not exist must answer **404 with a structured JSON error**, never a blank body or an unhandled stack trace. Compare with Request 1 (same path shape, same content type, opposite status code).

---

## 4. Requesting an identity-scoped resource without credentials

### Request

```bash
curl -i -sS "https://api.github.com/user"
```

As sent on the wire (from `curl -v`):

```http
 GET /user HTTP/2
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/2 401 
content-type: application/json; charset=utf-8
x-github-media-type: github.v3; format=json
access-control-expose-headers: ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, X-GitHub-Edge-Region, Deprecation, Sunset
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
vary: Accept-Encoding, Accept, X-Requested-With
server: github.com
date: Wed, 07 Oct 2026 18:04:33 GMT
x-ratelimit-limit: 60
x-ratelimit-remaining: 47
x-ratelimit-used: 13
x-ratelimit-resource: core
x-ratelimit-reset: 1791399491
content-length: 120
x-github-request-id: C267:C123A:110EFA:1250D0:6AC689C6
x-github-edge-region: centralindia

{
  "message": "Requires authentication",
  "documentation_url": "https://docs.github.com/rest",
  "status": "401"
}
```

### Annotation

- **Status code** — **401 Unauthorized** — `/user` resolves entirely against the caller's identity, and no `Authorization` header was sent, so there is no principal to resolve. 401 says “prove who you are”; it is distinct from 403 Forbidden (“I know who you are, and you still may not”).
- **Content-Type** — **application/json; charset=utf-8** — authentication failures are delivered in the same JSON error envelope as every other failure, so one interceptor can handle 401, 404 and 422 uniformly.
- No `WWW-Authenticate` challenge header is present here because the API does not offer a usable challenge scheme for browser clients; it simply returns the JSON error. Note the response omits `etag`/`last-modified` — an authorization failure must never be cached.

---

## 5. A syntactically valid but semantically invalid request

### Request

```bash
curl -i -sS "https://api.github.com/search/repositories?q="
```

As sent on the wire (from `curl -v`):

```http
 GET /search/repositories?q= HTTP/2
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/2 422 
date: Wed, 07 Oct 2026 18:04:54 GMT
content-type: application/json; charset=utf-8
content-length: 219
cache-control: no-cache
vary: Accept,Accept-Encoding, Accept, X-Requested-With
x-github-media-type: github.v3; format=json
x-github-api-version-selected: 2022-11-28
access-control-expose-headers: ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset, Warning
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
server: github.com
x-ratelimit-limit: 10
x-ratelimit-remaining: 8
x-ratelimit-used: 2
x-ratelimit-resource: search
x-ratelimit-reset: 1791396295
x-github-request-id: C268:2B1B37:10D1AA:121287:6AC689C6
x-github-edge-region: centralindia

{
  "message": "Validation Failed",
  "errors": [
    {
      "resource": "Search",
      "field": "q",
      "code": "missing"
    }
  ],
  "documentation_url": "https://docs.github.com/v3/search",
  "status": "422"
}
```

### Annotation

- **Status code** — **422 Unprocessable Content** — the request-line parses fine, but `q=` is empty where a query term is required. 422 is the correct code: the failure is in the *meaning* of the payload, not in its syntax (that would be 400) and not in the existence of a resource (that would be 404).
- **Content-Type** — **application/json; charset=utf-8** — the body enumerates the exact fault location (`resource: Search`, `field: q`, `code: missing`), which is the level of detail a form or an API client needs in order to repair the request.
- This endpoint uses a separate, smaller quota (`x-ratelimit-resource: search`, limit 10) — an example of one API applying different policies to different resources while keeping one wire format.

---

## 6. A 3xx response — redirect from plaintext HTTP to HTTPS

### Request

```bash
curl -i -sS "http://api.github.com/zen"
```

As sent on the wire (from `curl -v`):

```http
 GET /zen HTTP/1.1
 Host: api.github.com
 User-Agent: curl/8.7.1
 Accept: */*
 
```

### Response

```http
HTTP/1.1 301 Moved Permanently
Content-Length: 0
Location: https://api.github.com/zen
```

### Annotation

- **Status code** — **301 Moved Permanently** — the resource has a permanent new home; the client must retry at the URL given in the `Location` header. curl did not follow it because `-L` was not supplied, which is precisely why `-i` is used here: the redirect itself is the thing under inspection.
- **Content-Type** — **No `Content-Type` header** — there is no body to describe. A `Content-Type` only exists when there is content; an empty 301 carries its entire meaning in the status line plus `Location`.
- Because this request used plaintext `http://`, curl negotiated **HTTP/1.1** rather than HTTP/2 (h2 requires TLS), which is why this status line carries a reason phrase — `301 Moved Permanently` — while the HTTPS responses above read only `HTTP/2 200`. Both forms are valid: HTTP/2's binary framing drops the reason phrase, and the three digits alone carry the semantics. This is also the only 3xx in the set, and the only response with no body.

---

## Summary

| # | Request-target | Status | Content-Type | One-line meaning |
|---|---|---|---|---|
| 1 | `GET /repos/neha-nupur/AegisAi` | `200` | `application/json; charset=utf-8` | Success — the repository representation was returned in JSON. |
| 2 | `GET /repos/neha-nupur/AegisAi/commits?per_page=1` | `200` | `application/json; charset=utf-8` | Success — a JSON array, with pagination advertised in the `link` header. |
| 3 | `GET /repos/neha-nupur/aegisai-does-not-exist` | `404` | `application/json; charset=utf-8` | **Deliberate failure** — the resource does not exist, reported as a typed JSON error. |
| 4 | `GET /user` | `401` | `application/json; charset=utf-8` | No credentials were supplied to resolve an identity-scoped resource. |
| 5 | `GET /search/repositories?q=` | `422` | `application/json; charset=utf-8` | Well-formed request, invalid semantics: the `q` field is empty. |
| 6 | `GET http://api.github.com/zen` | `301` | *(absent — `Content-Length: 0`)* | Permanent redirect: retry at the URL in `Location`. |

**Coverage of the task:** six requests (≥ 5 required) · one deliberate 404 (required) · codes 200, 301, 401, 404, 422 across the 2xx, 3xx and 4xx classes · every pair annotated for both its status code and its `Content-Type`.

---

## What this teaches the AegisAI contract

AegisAI exposes a REST API of its own (Assignment 4). Four rules are taken directly from the transcripts above:

1. **Every failure is a typed body.** GitHub answers 401, 404 and 422 with `application/json` and a stable shape. AegisAI's gateway must do the same, so that a client's error interceptor is written once.
2. **Pick the narrowest correct status.** 404 (absent), 401 (unproven identity), 403 (proven but denied) and 422 (semantically invalid) are four different facts; collapsing them into a single 400 or 500 destroys information the client needs.
3. **Say what the body is.** `Content-Type` is never optional for a representation — the one response without a body is the one response without a `Content-Type`.
4. **Quota and caching are protocol, not policy.** `x-ratelimit-*` and `etag` are ordinary headers. AegisAI's own rate-limiting and idempotency layers should be observable on the wire in the same way.

