# WIGO build dashboard

One read-only page that answers three questions in 30 seconds: what is built, what is still ours, and what is waiting on someone else and for how long.

- Plain HTML and JavaScript. No build step, no login, works on a phone.
- Every number is calculated from `data.json`. Nothing on the page is typed by hand.
- Seeded from the follow-ups register in `latent-0/wigo-admin`, branch `admin-design`: `docs/FOLLOWUPS_AND_DEPENDENCIES.md` (O and X items) and `docs/ADMIN_MILESTONES.md` (M1 to M16), as of 16 Nov 2026.

## Page sections

1. **Header.** Last updated time (IST), next dated milestone, share of our work done (built ÷ all ours items), built, in progress, still ours, blocked on others.
2. **Milestone strip.** M1 to M16. Green built, amber in progress, grey not started, red blocked. Tap one for its name, note and evidence.
3. **Our side.** Filter by owner and status. Overdue rows are marked red.
4. **Blocked on others.** Who holds it, what we need, date asked, days waiting (calculated), what is already built and waiting. Longest wait first.
5. **Proof of work.** Commits per person per day for the last 7 days from the GitHub API.

## Rules the page enforces

- An item or milestone marked `built` without an `http(s)` evidence link shows as **in progress**, with a "No evidence link" tag.
- An item with `"placeholder": true` (dummy payment, dummy hardware feeds) is labelled **Placeholder** and never counted as built.
- Percentages and days waiting are always calculated. Any extra number typed into `data.json` is ignored.
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
| `owner` | `Shiva`, `Kunal`, `Kim`, `n1co`, `Meta`, `Hexup`, `Eric` |
| `holder` | External only. Who holds it, as shown on the page, e.g. `n1co (Wilber)` |
| `needs` | External only. What we need from them |
| `built_waiting` | External only. What is already built and waiting on it |
| `asked_on` / `due` | `YYYY-MM-DD`. Days waiting and overdue are calculated |
| `evidence` | Link to a commit, PR or staging. Required for `built` |
| `placeholder` | `true` for dummy work. Never shown as built |
| `updated_on` | Last change date |
| `note` | Optional one-line context |

Kim signs off by setting `meta.reviewed_by` and `meta.reviewed_on`.

## Commit chart setup

Set these on the Vercel project (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token, read-only **Contents** on the repos below. Required. |
| `GITHUB_REPOS` | Optional. Overrides `github.repos` in `data.json`. Comma-separated `owner/repo` or `owner/repo@branch`. |
| `AUTHOR_MAP` | Optional JSON mapping a GitHub login or commit name to a person, e.g. `{"shiva-gh":"Shiva"}`. Merged over `github.authors` in `data.json`. |

The token stays on the server; the browser only gets the counts. Until it is set, section 5 says "Not connected yet".

## Run locally

```bash
npm run dev
```

Opens on http://localhost:3000. Tests:

```bash
npm test
```

## Move to the company accounts

1. Create the repo under the WIGO or DayOne GitHub organisation and push this code to it (`git remote set-url origin <new-url>` then `git push -u origin main`).
2. In the company Vercel account: Add New → Project → import that repo. Framework preset **Other**, no build command, no output directory.
3. Add `GITHUB_TOKEN` (from a company-owned GitHub account) under Environment Variables, then redeploy.
4. Turn off Vercel Authentication (Settings → Deployment Protection) so the one shared link opens without a login.
5. Update the `github.repos` list in `data.json` to the new repo names, then hand the Vercel and GitHub credentials to Kim.

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
