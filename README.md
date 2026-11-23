# WIGO progress dashboard

One read-only page that answers three questions in 30 seconds: what is built, what is still ours, and what is waiting on someone else and for how long.

- Plain HTML and JavaScript. No build step, no login, works on a phone.
- Every number is calculated, never typed by hand.
- **Live from wigo-admin.** Milestones (M1 to M16), our items (O#) and external items (X#) are read on every page load from `kunalachintya-dayone/wigo-admin`, branch `admin-design`: `docs/ADMIN_MILESTONES.md` and `docs/FOLLOWUPS_AND_DEPENDENCIES.md`. A milestone's evidence link is the commit that records or closes it ("record milestone 14", "Close milestone 12"). When that register changes, the page follows within 5 minutes, with no edit here.
- **Test results, live.** wigo-admin's "Test results" workflow (`.github/workflows/test-results.yml`) runs the server and web suites on every push to `admin-design` and `main`, and daily, and writes one row per test file to `results/<branch>.json` on its `test-results` branch. The page groups those files into the areas in `testing.areas`.
- **From `data.json`.** Everything the register does not hold: owners, ask dates, due dates, hand-written notes and evidence (which win over the live values), partner asks, team updates, bugs and waitlist. It is also the saved copy the page falls back to if GitHub cannot be reached; a banner at the top says which source is showing.

## Page sections

A sticky bar at the top jumps to each view. Every view has a link anchor, e.g. `/#n1co`.

1. **Overall progress** (`#progress`). Admin console progress (milestones built ÷ all milestones, with milestones in progress shown beside it), open follow-up items built, in progress, still ours, blocked on others, next dated milestone, and M1 to M16 as built, in progress, not started or blocked. Tap a milestone for its note and evidence.
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

Built or not built comes from the wigo-admin register, so there is nothing to change here when a milestone lands. Edit `data.json` only for what the register does not hold.

1. Edit `data.json` on GitHub (pencil icon) or locally.
2. Update team updates, partner asks (`received_on`), testing, waitlist, and any ask or due dates. Set an item's `status` to `in_progress` or `blocked` only when the register shows it as not built but work has started or stalled; that is the one status the live register does not overwrite. Set `updated_on` to today.
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
| `testing.areas[]` | `area`, `match[]`, `note` | Groups live test files into areas. A pattern without `/` matches the file name without `.test.ts` (`agent-*`, `payments`); with `/` it matches the path (`web/*`). Files that match nothing show under **Other**, so add a pattern when a new test file appears. |
| `testing.source` | `repo`, `branch`, `path` | Where the live results are read: `kunalachintya-dayone/wigo-admin`, `test-results`, `results/admin-design.json`. |
| `testing.suites[]` | `area`, `written`, `executed`, `passed`, `updated_on`, `evidence` | Saved copy, shown only when live results cannot be read. |
| `testing.bugs[]` | `id`, `title`, `status` (`open`/`closed`), `severity` (`critical`/`high`/`medium`/`low`), `owner`, `opened_on`, `closed_on`, `link` | |
| `waitlist.days[]` | `date`, `size`, `converted` | One row per day from Eric's export. |

Kim signs off by setting `meta.reviewed_by` and `meta.reviewed_on`.

## GitHub setup (live register and Code updates)

Set these on the Vercel project (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token, read-only **Contents** on the repos below. Required. |
| `GITHUB_REPOS` | Optional. Overrides `github.repos` in `data.json`. Comma-separated `owner/repo` or `owner/repo@branch`. |
| `AUTHOR_MAP` | Optional JSON mapping a GitHub login or commit name to a person, e.g. `{"shiva-gh":"Shiva"}`. Merged over `github.authors` in `data.json`. |

The same token reads the live register: `register_source` in `data.json` names the repo, branch and the two files (defaults: `kunalachintya-dayone/wigo-admin`, `admin-design`). Without the token the page shows the saved copy in `data.json`.

### Shiva's rider app (WIGOAPP)

The page shows Kunal's work (admin console) and Shiva's work (rider app) separately, then a combined view. Shiva's side is read live from `Shivadevdayone/WIGOAPP` by `/api/app`, named by `app_source` in `data.json`:

- the build status in `README.md`: screen counts per workflow (`WF 01`, `WF 02`), the vendor adapter table and the "still genuinely open" list. Each workflow and each adapter is one workstream. Real is built, conditionally real or actively being built is in progress, blocked on someone is blocked, anything else is not started.
- the latest commits on `main`, shown as they land.

WIGOAPP is private and `GITHUB_TOKEN` is Kunal's, so Shiva's repo has its own variable: `WIGOAPP_TOKEN`, a fine-grained token with read-only **Contents** on `Shivadevdayone/WIGOAPP` (created by Shiva, or by anyone with access to it). It feeds `/api/app` and, for repos owned by `Shivadevdayone`, Code updates too. Without it Shiva's section shows the saved copy and Code updates skips that repo; Kunal's side is unaffected. Keep the README's headline lines, adapter table and open list in their current shape and the numbers follow; if the shape changes the page falls back to the saved copy in `data.json -> app`. Refresh that copy when the README changes much.

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

The site is the Vercel project `wigo-progress-dashboard` in the `dayone-ventures` team, at https://wigo-progress-dashboard.vercel.app. It is connected to this repo: every push to `claude/wizardly-goldberg-c1gcb7` deploys to production. `GITHUB_TOKEN` and `WIGOAPP_TOKEN` are set on the project, so everything reads live. Standard deployment protection: the production URL opens without a login and preview URLs need one.

## Files

```
index.html, styles.css, app.js   the page
lib/compute.js                   every calculation and the data checks (shared by page, script and tests)
lib/register.js                  reads the wigo-admin register and merges it over data.json
lib/app.js                       reads Shiva's WIGOAPP README and merges it over data.json
data.json                        the only file updated day to day
api/commits.js                   Vercel function for Code updates
api/register.js                  Vercel function that reads the live register from wigo-admin
api/app.js                       Vercel function that reads Shiva's progress from WIGOAPP
scripts/check-data.mjs           validates data.json
scripts/dev-server.mjs           local preview
assets/                          WIGO logo and icons (from wigoenergy.com)
test/                            node --test suite
```
