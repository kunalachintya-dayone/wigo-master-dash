# Session handoff: WIGO progress dashboard

Last updated 18 Nov 2026. Read this before changing the dashboard. `README.md` covers how the page works and the daily update; this file covers where the project stands.

## Goal

One read-only page, shared with Eric and Kim, showing what is built, what is still ours, and what is waiting on others. Ten views: progress, n1co, Hexup, Meta and designs, team, tracker, code updates, testing, waitlist, dependencies. Every number is calculated from `data.json` in `lib/compute.js`.

## History

1. Cloud session `session_015Sxca2vxVeDhfFoxNsJ8mM` built the first version (`f3475b3`), then the ten views (`854d58a`), real data from wigo-admin (`63b8430`) and the `kunalachintya-dayone` author mapping (`21bbc08`). It opened PR #1.
2. The repos `wigo-admin`, `wigo-admin-gabriel` and `wigo-master-dash` moved from `latent-0` to `kunalachintya-dayone`. The cloud session could no longer push, so work continued in a local session.
3. Local session: merged PR #1 (fast-forward), changed every `latent-0/` repo and evidence link in `data.json` to `kunalachintya-dayone/`, added this note. The `latent-0` author mapping stays so older commits still count as Kunal's.

## Which data is real

- Testing: real vitest run of wigo-admin `admin-design` at `b818e49`: 1,056 cases, 1,044 passed, 12 skipped (live-model tests that need an API key). No bug issues are filed, so the bug list is empty.
- Hexup: the seven asks follow the 17 Oct hardware response to Christopher Mihm.
- Commit evidence for the n1co payments port, Meta template library, WhatsApp webhook and missing-heartbeat alerts.
- wigo-admin is private, so evidence links open only for people with repo access.

## Still open

- Three Hexup tracks are marked built but have no evidence link (TCP protocol, cabinet confirmation in the swap flow, simulated-cabinet test). That code is in the rider backend, not wigo-admin. Add links from that repo.
- n1co documentation and webhook requests are dated 12 Oct, the same day as the sandbox request. Confirm the real date of the formal documentation request.
- Team updates come from the team daily; waitlist numbers come from Eric's export.
- `meta.reviewed_by` is empty until Kim signs off, so the "Not yet reviewed" banner shows.

## Hosting

- Live site: Vercel project `wigo-progress-dashboard` in the `dayone-ventures` team, https://wigo-progress-dashboard.vercel.app. Kunal chose this team on 18 Nov. It is Git-linked to `kunalachintya-dayone/wigo-master-dash`, production branch `claude/wizardly-goldberg-c1gcb7` (the repo default), so every push to that branch redeploys in under a minute.
- `GITHUB_TOKEN` is set there (Production, secret, read-only Contents on wigo-admin and wigo-master-dash). It feeds both Code updates and the live register (`/api/register`).
- Production URL opens without a login; `docs/` and `CLAUDE.md` return 404.
- The Vercel connector some sessions use is signed in to a different account, the "Kunal's projects" team. Its project `wigo-build-dashboard` (`prj_hoaOC7gbh8RBVCZVPWE4yagGONdE`) is the old copy, still linked to `latent-0/wigo-master-dash`. Do not deploy there; Kunal decides when to retire it. Work on dayone-ventures through the Vercel dashboard.
- Renaming the default branch to `main` was offered and declined for now.
