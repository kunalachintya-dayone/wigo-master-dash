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

- Vercel project `wigo-build-dashboard` (`prj_hoaOC7gbh8RBVCZVPWE4yagGONdE`) in the "Kunal's projects" team serves https://wigo-build-dashboard.vercel.app. It is the only Vercel team on the account, so the earlier plan to move to a `dayone-ventures` team is dropped unless that team is created.
- Standard deployment protection: the production URL opens without a login; preview URLs need one.
- The project is still linked to `latent-0/wigo-master-dash`, so pushes here do not redeploy. Production is updated by a direct file deploy of a commit on the default branch.
- Last direct deploy: 18 Nov 2026, commit `e21a8d2`, deployment `dpl_2CeoPoUeN284Fymaaa7eJj7QzBbm`. Checked live: all ten views render with no console errors, `data.json` is current, `docs/` returns 404.
- Still needed from the owner (cannot be done from a session): install the Vercel GitHub app on `kunalachintya-dayone` and reconnect the project's Git to `kunalachintya-dayone/wigo-master-dash`; add `GITHUB_TOKEN` (fine-grained, read-only Contents on wigo-admin and wigo-master-dash). Never paste it in a chat.
- The production branch is `claude/wizardly-goldberg-c1gcb7`, the repo default. Renaming it to `main` is a GitHub settings change (Settings, Branches, rename default branch); do it before relinking Vercel so the production branch is set once.
