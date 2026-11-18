# WIGO progress dashboard

One read-only page that answers three questions in 30 seconds: what is built, what is still ours, and what is waiting on someone else and for how long.

- Plain HTML and JavaScript. No build step, no login, works on a phone.
- Every number is calculated from `data.json`. Nothing on the page is typed by hand.
- Seeded from the follow-ups register in `kunalachintya-dayone/wigo-admin`, branch `admin-design`: `docs/FOLLOWUPS_AND_DEPENDENCIES.md` (O and X items) and `docs/ADMIN_MILESTONES.md` (M1 to M16), as of 16 Nov 2026.

## Page sections

A sticky bar at the top jumps to each view. Every view has a link anchor, e.g. `/#n1co`.

1. **Overall progress** (`#progress`). Share of in-our-control work done (built ÷ all ours items), built, in progress, still ours, blocked on others, next dated milestone, and M1 to M16 as built, in progress, not started or blocked. Tap a milestone for its note and evidence.
2. **n1co** (`#n1co`). Payment documentation, sandbox and webhooks: asked on, received, days waiting. Joint testing status.
3. **Hexup** (`#hexup`). Hardware and cabinet integration status, and what is still needed from them.
4. **Meta and module designs** (`#meta`). WhatsApp and Meta approvals, and design status for Energy, Inventory, Planning and Data Platform.
5. **Team** (`#team`). Shiva, Kunal, Sneha and Ajay: current task and status from the tracker, plus the daily update. Flags anyone with no update today.
6. **Progress tracker** (`#tracker`). Every item (ours and others) with owner, status, due and evidence. Filter by side, owner and status, including "Missing evidence".
7. **Code updates** (`#code`). Commits and releases per person this week, commits per day, and the release list, from the GitHub API.
8. **Testing updates** (`#testing`). Test cases written, executed and passed, and open bugs by severity.
9. **Waitlist and conversion** (`#waitlist`). Waitlist size, riders converted and conversion rate, each with the change since the previous day.
10. **Dependencies** (`#dependencies`). Items waiting on Eric or on third parties, longest wait first. Over 14 days is flagged amber, over 30 red.

## Rules the page enforces

- An item or milestone marked `built` without an `http(s)` evidence link shows as **in progress**, with a "No evidence link" tag.
- An item with `"placeholder": true` (dummy payment, dummy hardware feeds) is labelled **Placeholder** and never counted as built.
- Percentages and days waiting are always calculated. Any extra number typed into `data.json` is ignored.
- A team member's task and status come from the items they own. Only the update text is typed.
- Test totals, conversion rate and daily changes are calculated. Executed can never exceed written, nor passed exceed executed.
- Until `meta.reviewed_by` is filled in, a yellow "Not yet reviewed" banner shows at the top.

## Daily update (Shiva, by 6 pm IST)

1. Edit `data.json` on GitHub (pencil icon) or locally.
2. For each item that changed: set `status`, add the `evidence` link for anything `built`, set `updated_on` to today.
3. Set `meta.updated_at` to now, for example `2026-11-19T18:00:00+05:30`.
4. Run the check (or let GitHub Actions run it on push):

   ```bash
   node scripts/check-data.mjs
   ```

5. Commit and push. Vercel redeploys in about a minute.

### Fields

| Field | Meaning |
|---|---|
| `id` | `M1`–`M16` milestones, `O#` ours, `X#` external |
| `title` | Short name |
| `milestone` | `M1` to `M16` |
| `type` | `ours` or `external` |
| `status` | `built`, `in_progress`, `not_started`, `blocked` |
| `owner` | `Shiva`, `Kunal`, `Sneha`, `Ajay`, `Kim`, `n1co`, `Meta`, `Hexup`, `Eric` |
| `holder` | External only. Who holds it, as shown on the page, e.g. `n1co (Wilber)` |
| `needs` | External only. What we need from them |
| `built_waiting` | External only. What is already built and waiting on it |
| `asked_on` / `due` | `YYYY-MM-DD`. Days waiting and overdue are calculated |
| `evidence` | Link to a commit, PR or staging. Required for `built` |
| `placeholder` | `true` for dummy work. Never shown as built |
| `updated_on` | Last change date |
| `note` | Optional one-line context |

### Other sections in `data.json`

| Section | Fields | Notes |
|---|---|---|
| `team[]` | `name`, `role`, `focus`, `update`, `updated_on` | `focus` is an optional item id to show as the current task; otherwise the most active open item is shown. Set `update` and `updated_on` daily. |
| `partners[]` | `id`, `name`, `contact`, `items`, `asks[]`, `tracks[]` | Ids `n1co`, `hexup`, `meta` and `designs` feed views 2 to 4. An ask has `title`, `asked_on`, `received_on`, `note`; set `received_on` the day it arrives. A track has `title`, `status`, `evidence`, `note` and follows the same evidence rule as items. |
| `testing.suites[]` | `area`, `written`, `executed`, `passed`, `updated_on`, `evidence` | One row per area; link the test run. |
| `testing.bugs[]` | `id`, `title`, `status` (`open`/`closed`), `severity` (`critical`/`high`/`medium`/`low`), `owner`, `opened_on`, `closed_on`, `link` | |
| `waitlist.days[]` | `date`, `size`, `converted` | One row per day from Eric's export. |

Kim signs off by setting `meta.reviewed_by` and `meta.reviewed_on`.

## Commit chart setup

Set these on the Vercel project (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token, read-only **Contents** on the repos below. Required. |
| `GITHUB_REPOS` | Optional. Overrides `github.repos` in `data.json`. Comma-separated `owner/repo` or `owner/repo@branch`. |
| `AUTHOR_MAP` | Optional JSON mapping a GitHub login or commit name to a person, e.g. `{"shiva-gh":"Shiva"}`. Merged over `github.authors` in `data.json`. |

Releases are read from each repo's GitHub releases. Map Shiva's, Sneha's and Ajay's GitHub logins in `github.authors` or `AUTHOR_MAP` so their commits are named. The token stays on the server; the browser only gets the counts. Until it is set, Code updates says "Not connected yet".

## Run locally

```bash
npm run dev
```

Opens on http://localhost:3000. Tests:

```bash
npm test
```

## Hosting

The repo is `kunalachintya-dayone/wigo-master-dash`. The site is the Vercel project `wigo-build-dashboard` in the "Kunal's projects" team, at https://wigo-build-dashboard.vercel.app. Standard deployment protection is on, so the production URL opens without a login and preview URLs need one.

The Vercel project is still linked to the old `latent-0/wigo-master-dash` address, so a push to this repo does not redeploy the site yet. To fix that once:

1. Install the Vercel GitHub app on `kunalachintya-dayone` (https://github.com/apps/vercel) with access to this repo.
2. In Vercel, open `wigo-build-dashboard`, go to Settings, then Git, and connect `kunalachintya-dayone/wigo-master-dash`. Set the production branch to the repo's default branch.
3. Add `GITHUB_TOKEN` under Environment Variables (fine-grained, read-only Contents on `wigo-admin` and `wigo-master-dash`, owned by `kunalachintya-dayone`), then redeploy.

Until then, production is updated by deploying the files directly. The last direct deploy is recorded in `docs/SESSION_HANDOFF.md`.

## Files

```
index.html, styles.css, app.js   the page
lib/compute.js                   every calculation and the data checks (shared by page, script and tests)
data.json                        the only file updated day to day
api/commits.js                   Vercel function for section 5
scripts/check-data.mjs           validates data.json
scripts/dev-server.mjs           local preview
assets/                          WIGO logo and icons (from wigoenergy.com)
test/                            node --test suite
```
