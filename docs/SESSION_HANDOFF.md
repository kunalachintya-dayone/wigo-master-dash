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

- Moving to the `dayone-ventures` Vercel team. The old project `wigo-build-dashboard` (`prj_hoaOC7gbh8RBVCZVPWE4yagGONdE`) in the "Kunal's projects" team still points at `latent-0/wigo-master-dash` and serves the first version at `wigo-build-dashboard.vercel.app`. Retire it once the new one is live.
- The Vercel GitHub app must be installed on `kunalachintya-dayone` before Vercel can import the repo.
- `GITHUB_TOKEN` (fine-grained, read-only Contents on wigo-admin and wigo-master-dash, owned by `kunalachintya-dayone`) must be added in Vercel. Never paste it in a chat.
- Production branch is `claude/wizardly-goldberg-c1gcb7` (the repo default). Switching to `main` is recommended so daily `data.json` edits go to one obvious branch.
- Turn off Vercel Authentication on the new project so the shared link opens without a login.
