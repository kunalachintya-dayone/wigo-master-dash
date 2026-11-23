# Session handoff: WIGO progress dashboard

Last updated 18 Nov 2026. Read this before changing the dashboard. `README.md` covers how the page works and the daily update; this file covers where the project stands.

## Goal

One read-only page, shared with Eric and Kim, showing what is built, what is still ours, and what is waiting on others. Twelve views: combined, Kunal's admin console, Shiva's rider app, n1co, Hexup, Meta and designs, team, tracker, code updates, testing, waitlist, dependencies. Every number is calculated from `data.json` in `lib/compute.js`.

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

## Two people, one page

Kunal's progress comes from wigo-admin (`/api/register`); Shiva's from `Shivadevdayone/WIGOAPP` (`/api/app`, see README, "Shiva's rider app"). The Combined view adds the two (`computeCombined` in `lib/compute.js`). WIGOAPP is private: Vercel needs a separate `WIGOAPP_TOKEN` (read-only Contents on that repo); `GITHUB_TOKEN` is Kunal's and cannot see it. Without it the rider app shows the saved copy in `data.json -> app`. Shiva's README build status is dated 12 Nov and lags the commits, so the commit list is the fresher signal.

## Hosting

- **Live site:** https://wigo-progress-dashboard.vercel.app, Vercel project `wigo-progress-dashboard` (`prj_g5IXSHMfGJ9tAhpnQbY78seZIK4c`) in the `dayone-ventures` team of the Vercel account kunal@dayoneventurepartners.com (`kunalachintya-dayone`).
- Git: connected to `kunalachintya-dayone/wigo-master-dash`. Every push to `claude/wizardly-goldberg-c1gcb7` deploys to production by itself. No manual deploys.
- `GITHUB_TOKEN` and `WIGOAPP_TOKEN` are set (sensitive, production). The register, commits, tests and Shiva's WIGOAPP feed all read live (checked 23 Nov 2026). The owner will rotate `GITHUB_TOKEN` to a fine-grained read-only token later.
- Standard protection: the production URL opens without a login.
- **Old site:** `wigo-build-dashboard.vercel.app` in the old account (kunalachintya01@gmail.com, team "Kunal's projects") is no longer updated. Retire it once the new link has been shared.
