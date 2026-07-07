# Vulnerability Scanning Report — Observability Stack

**Date:** 2026-07-06
**Scope:** `backend/` (Python / FastAPI) and `frontend/` (Next.js / React)
**Author:** Security scan (automated)

---

## 1. Methodology & Tools

| Layer | Target | Tool | Notes |
|-------|--------|------|-------|
| Backend deps (SCA) | `backend/uv.lock` (225 resolved pkgs) | `pip-audit` (PyPI Advisory + OSV) | Exported via `uv export`, all groups |
| Backend code (SAST) | `backend/app`, `backend/observix` (9,704 LOC) | `bandit` | Static analysis |
| Frontend deps (SCA) | `frontend/package-lock.json` (521 pkgs) | OSV.dev batch API | npm 6 could not parse lockfile v3, so OSV was queried directly |
| Config / secrets | repo config, `.env`, Dockerfiles | manual review | |

Severity bands are derived from CVSS v3.1/v4.0 base scores in the advisory data where available; advisories without a published vector are marked **UNRATED** and should be triaged manually. CVE identifiers reflect the advisory databases as of the scan date.

---

## 2. Executive Summary

| Area | Critical | High | Medium | Low | Unrated | Total advisories |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Backend dependencies | 1 | 14 | 8 | 2 | 4 | **90** (across 29 pkgs) |
| Backend code (bandit) | – | 1 | 38 | 28 | – | **67** |
| Frontend dependencies | 0 | 8 | 7 | 1 | – | **60** (across 16 pkgs) |
| Config / secrets | – | 1 | 2 | – | – | **3** |

**Top priorities**
1. **`diskcache` 5.6.3 — CRITICAL (9.8)** insecure pickle deserialization (RCE class).
2. **Auth-path dependencies:** `pyjwt` 2.10.1 (7 advisories, JWT verification flaws) and `litellm` 1.80.15 (multiple auth-bypass CVEs).
3. **Weak default `SECRET_KEY`** fallback in [security.py](backend/app/core/security.py#L10) and a **world-writable `.env`** (0777) at the repo root.
4. **Frontend framework:** `next` 16.1.1 (22 advisories, incl. middleware/proxy bypass & cache poisoning) and `axios` 1.13.2 (24 advisories, prototype pollution / SSRF).

---

## 3. Backend — Dependency Vulnerabilities

Packages ranked by highest severity. "n" = number of advisories affecting the pinned version.

| Severity | Package | Version | n | Fix version | Key issue |
|----------|---------|---------|:--:|-------------|-----------|
| 🔴 CRITICAL 9.8 | `diskcache` | 5.6.3 | 1 | *(no fix released)* | Pickle used for serialization by default → deserialization RCE (CVE-2025-69872) |
| 🟠 HIGH 8.6 | `python-multipart` | 0.0.21 | 6 | 0.0.30 | Arbitrary file write; multiple form-parsing CVEs (used by FastAPI form/upload endpoints) |
| 🟠 HIGH 8.0 | `litellm` | 1.80.15 | 8 | 1.83.14 | Auth bypass via OIDC cache-key collision & Host-header injection; pass-the-hash |
| 🟠 HIGH 8.0 | `pillow` | 12.1.0 | 6 | 12.2.0 | Multiple image-parsing memory-safety CVEs |
| 🟠 HIGH 8.0 | `protobuf` | 6.33.2 | 1 | 6.33.5 | DoS (CVE-2026-0994) |
| 🟠 HIGH 8.0 | `urllib3` | 2.6.2 | 3 | 2.6.3 / 2.7.0 | Decompression-bomb bypass on redirects; cross-origin redirect leak |
| 🟠 HIGH 7.7 | `langsmith` | 0.6.2 | 4 | 0.8.18 | Multiple advisories |
| 🟠 HIGH 7.5 | `aiohttp` | 3.13.3 | 21 | 3.14.1 | Large cluster of request-smuggling / parsing CVEs |
| 🟠 HIGH 7.5 | `pyjwt` | 2.10.1 | 7 | 2.13.0 | **JWT verification flaws** — issuer/detached-payload validation (auth-critical) |
| 🟠 HIGH 7.5 | `starlette` | 0.50.0 | 5 | 1.3.1 | `request.form()` DoS; Host-header path poisoning (bypasses path-based security) |
| 🟠 HIGH 7.5 | `tornado` | 6.5.4 | 7 | 6.5.7 | Multiple advisories |
| 🟠 HIGH 7.5 | `orjson` | 3.11.5 | 1 | 3.11.6 | |
| 🟠 HIGH 7.2 | `langgraph` | 1.0.5 | 1 | 1.0.10 | |
| 🟠 HIGH 7.1 | `wheel` | 0.45.1 | 1 | 0.46.2 | Build-time only |
| 🟠 HIGH 7.0 | `pyarrow` | 22.0.0 | 1 | 23.0.1 | |
| 🟡 MEDIUM | `pytest` | 9.0.2 | 1 | 9.0.3 | Dev/test only |
| 🟡 MEDIUM | `langgraph-checkpoint` | 3.0.1 | 2 | 4.1.1 | |
| 🟡 MEDIUM | `langchain-text-splitters` | 1.1.0 | 1 | 1.1.2 | |
| 🟡 MEDIUM | `filelock` | 3.20.2 | 1 | 3.20.3 | |
| 🟡 MEDIUM | `idna` | 3.11 | 1 | 3.15 | |
| 🟡 MEDIUM | `pydantic-settings` | 2.12.0 | 1 | 2.14.2 | |
| 🟡 MEDIUM | `langchain` | 1.2.3 | 1 | 1.3.9 | |
| 🟡 MEDIUM | `virtualenv` | 20.36.0 | 1 | 20.36.1 | Build-time only |
| 🟢 LOW | `langchain-core` | 1.2.6 | 3 | 1.3.3 | |
| 🟢 LOW | `langchain-openai` | 1.1.7 | 1 | 1.1.14 | |
| ⚪ UNRATED | `langgraph-sdk` | 0.3.1 | 1 | 0.3.15 | Triage manually |
| ⚪ UNRATED | `pygments` | 2.19.2 | 1 | 2.20.0 | |
| ⚪ UNRATED | `python-dotenv` | 1.2.1 | 1 | 1.2.2 | |
| ⚪ UNRATED | `ragas` | 0.4.2 | 1 | *(no fix)* | |

**Notes on exposure**
- `pyjwt`, `starlette` (via `fastapi`), `python-multipart`, `httpx`/`urllib3` and `cryptography` are on the **direct request/auth path** → prioritize.
- `aiohttp`, `tornado`, `langchain*`, `langgraph*`, `langsmith`, `ragas`, `diskcache`, `pillow`, `pyarrow` are pulled transitively via `observix[eval]` and `litellm`. Risk depends on whether the eval/LLM pipeline processes untrusted input; still upgrade.
- `pytest`, `virtualenv`, `wheel`, `filelock` are **build/dev-time** only — lower runtime risk.

---

## 4. Backend — Static Code Analysis (bandit)

Totals over 9,704 LOC: **1 High, 38 Medium, 28 Low.**

| Severity | Test | Count | Assessment |
|----------|------|:-----:|------------|
| 🟠 HIGH | `B324` weak MD5 hash | 1 | [alert_runner.py:212](backend/app/services/alert_runner.py#L212) — MD5 used to build an alert dedup key. **Not** a security context (not passwords/tokens), but add `usedforsecurity=False` to silence and document intent. |
| 🟡 MEDIUM | `B608` SQL built via string formatting | 37 | Dynamic SQL string construction (largely ClickHouse analytics queries). **Review for injection** anywhere user-controlled values reach these strings; prefer parameterized queries / bound params. |
| 🟡 MEDIUM | `B104` bind all interfaces | 1 | [main.py:50](backend/app/main.py#L50) — `uvicorn.run(host="0.0.0.0")`. Acceptable inside a container; ensure it is not exposed directly to the internet without a proxy. |
| 🟢 LOW | `B311` non-crypto `random` | 8 | Fine unless used for tokens/secrets — verify none feed security decisions. |
| 🟢 LOW | `B110` `try/except/pass` | 15 | Silent exception swallowing — review for masked errors. |
| 🟢 LOW | `B105` hardcoded password string | 4 | **Mostly false positives** (e.g. `token_type: "bearer"`), **except** the `SECRET_KEY` default — see §5. |
| 🟢 LOW | `B101` assert used | 1 | Asserts are stripped under `python -O`. |

> The 37 `B608` hits are the most important SAST class to triage — confirm every dynamic query interpolating request/user input is parameterized.

---

## 5. Configuration & Secrets

| Severity | Finding | Detail / Fix |
|----------|---------|--------------|
| 🟠 HIGH | Weak default JWT secret | [security.py:10](backend/app/core/security.py#L10): `SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "CHANGE_THIS_TO_A_SECURE_SECRET_KEY")`. If the env var is unset in any environment, JWTs are signed with a **publicly known key → full auth forgery**. Fail fast (raise) when the var is missing instead of falling back. |
| 🟡 MEDIUM | World-writable `.env` | Repo-root `.env` is `-rwxrwxrwx` (0777) and contains secrets. `chmod 600 .env`. (`backend/.env`, `frontend/.env` are 0644 — tighten to 0600.) |
| 🟡 MEDIUM | Secrets on disk | `.env*` is correctly git-ignored (not tracked ✔). Ensure real secrets are injected via a secrets manager in production rather than plaintext files. |

---

## 6. Frontend — Dependency Vulnerabilities

521 packages scanned via OSV; 16 vulnerable (60 advisories). `(dev)` = build/tooling only.

| Severity | Package | Version | n | Key issue |
|----------|---------|---------|:--:|-----------|
| 🟠 HIGH | `next` | 16.1.1 | 22 | Middleware/proxy bypass (App & Pages Router), redirect cache poisoning, `next/image` disk exhaustion |
| 🟠 HIGH | `axios` | 1.13.2 | 24 | Prototype-pollution → MitM / credential theft / response tampering; `NO_PROXY` bypass → SSRF; CRLF injection; DoS |
| 🟠 HIGH | `form-data` | 4.0.5 | 1 | CRLF injection via unescaped multipart field/filenames |
| 🟠 HIGH | `minimatch` *(dev)* | 3.1.2, 9.0.5 | 3 ea | ReDoS |
| 🟠 HIGH | `picomatch` *(dev)* | 2.3.1, 4.0.3 | 2 ea | ReDoS |
| 🟠 HIGH | `flatted` *(dev)* | 3.3.3 | 2 | |
| 🟡 MEDIUM | `follow-redirects` | 1.15.11 | 1 | Leaks custom auth headers to cross-domain redirect targets |
| 🟡 MEDIUM | `postcss` | 8.4.31 / 8.5.6 | 1 ea | XSS via unescaped `</style>` in stringify output |
| 🟡 MEDIUM | `ajv`, `brace-expansion`, `js-yaml` *(dev)* | — | 1 ea | ReDoS / parsing |
| 🟢 LOW | `@babel/core` *(dev)* | 7.28.5 | 1 | |

**Runtime-exposed (prioritize):** `next`, `axios`, `form-data`, `follow-redirects`, `postcss`. The many `next`/`axios` advisories affect these exact pinned versions — bump to the latest patched releases.

---

## 7. Remediation Plan

**Immediate (this week)**
1. Replace the `SECRET_KEY` fallback with a hard failure when `JWT_SECRET_KEY` is unset; rotate the key.
2. `chmod 600` all `.env` files.
3. Upgrade / mitigate `diskcache` (CRITICAL) — pin caching to a non-pickle serializer or replace; there is no fixed release.
4. Upgrade auth-path deps: `pyjwt→2.13.0`, `litellm→1.83.14+`, `python-multipart→0.0.30`, `starlette` (via `fastapi`), `urllib3→2.7.0`.

**Short term**
5. Frontend: `next` and `axios` to latest patched versions; then `form-data`, `follow-redirects`, `postcss`. Refresh dev tooling (minimatch/picomatch/ajv/js-yaml).
6. Bulk-upgrade remaining HIGH backend deps (`aiohttp`, `tornado`, `pillow`, `protobuf`, `pyarrow`, `orjson`, `langchain*`, `langgraph*`, `langsmith`). Re-run `uv lock` and re-scan.
7. Triage the 37 `B608` dynamic-SQL sites — parameterize any that touch user input.

**Process**
8. Add CI gates: `pip-audit` (or `uv`-native audit) on the backend lock and `npm audit`/OSV on the frontend lock; fail the build on new High/Critical.
9. Triage the 4 UNRATED backend advisories manually.

---

## 8. Limitations
- Severity for advisories lacking a published CVSS vector is heuristic or **UNRATED** — confirm before acting.
- The local `observix` editable package was skipped by `pip-audit` (not on PyPI); its own code is covered by the bandit scan, but its dependency graph should be audited separately.
- Frontend was scanned via OSV rather than `npm audit` because the environment's npm 6 / Node 14 cannot parse a lockfile v3; upgrade the toolchain to enable native `npm audit`.
- SCA reports *known* advisories only; it is not a guarantee of absence of vulnerabilities.

---
*Generated with pip-audit, bandit, and OSV.dev. Re-run after each dependency bump.*
