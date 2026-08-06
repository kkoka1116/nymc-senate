# Routing feedback into Google Sheets

> **Status: live.** Sheet "NYMC Senate — Feedback", Apps Script deployed
> (v2), and the site posts through a Netlify Function. Verified
> end-to-end on Aug 6, 2026.

Every feedback submission lands on its own tab — Housing, Cafeteria,
Facilities, Class Year, Curriculum, Other — plus an **All Submissions**
master tab for trend analysis.

```
Student submits  →  /.netlify/functions/feedback  →  Apps Script  →  Google Sheet
                    (honeypot + spam checks,          (routes by
                     forwards server-side)             form name)
```

**Netlify Forms is deliberately not used.** Its free tier stops at 100
submissions/month, and quietly dropping student feedback is the worst way
for this to fail. Netlify *Functions* allow 125k invocations/month.

The function also keeps the request same-origin, so the page gets a real
status code and can show a truthful success or error state. Posting
straight from the browser to Apps Script would work but the response is
blocked by CORS, so the UI would have to assume success.

---

## One-time setup (~10 minutes)

### 1. Create the Sheet

New Google Sheet → name it something like **NYMC Senate — Feedback**.

### 2. Add the script

**Extensions → Apps Script.** Delete the placeholder `myFunction`, paste
everything from `apps-script/Code.gs`, and save.

### 3. Create the tabs

In the Apps Script toolbar, pick **`setupTabs`** from the function
dropdown and click **Run**. Google will ask for authorization the first
time — it's your own script writing to your own sheet, so approve it.
(You'll pass an "unverified app" screen: **Advanced → Go to … (unsafe)**.
That warning appears for every personal Apps Script.)

You should end up with 7 tabs, each with a maroon header row.

### 4. Deploy it as a web app

**Deploy → New deployment → ⚙️ → Web app**, then:

| Setting | Value |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Deploy, then **copy the Web app URL** — it ends in `/exec`.

> "Anyone" sounds alarming but means "any caller may POST here." The URL
> is unguessable and the script only ever appends rows. Nobody can read
> your Sheet through it.

### 5. Give Netlify the URL

Netlify dashboard → **Site configuration → Environment variables → Add a
single variable**:

| Key | Value |
|---|---|
| `APPS_SCRIPT_URL` | the `/exec` URL from step 4 |

Redeploy so the function picks it up.

The URL lives here rather than in the repo because the repo is public and
the endpoint accepts writes — anyone with it could append junk rows.

### 6. Test

Submit real feedback on the live site. Within a few seconds a row should
appear on the matching tab *and* on **All Submissions**.

Prefer to test without touching the site? In Apps Script, run
**`sendTestRow`** — it writes a labeled test row to the Cafeteria tab.

---

## Once it's running

- **Trends:** build charts off the **All Submissions** tab — count by
  Category, by Class Year, by month. That's the quantitative data the
  Senate wanted for showing admin that N students raised the same thing.
- **Follow-ups:** filter All Submissions where *Follow-up requested? = Yes*
  and work that list.
- **Keep the email notifications too.** Webhooks fill the Sheet; email
  notifications tell the right person immediately. Use both.

---

## Spam handling

Netlify's Akismet came with Netlify Forms, so `netlify/functions/feedback.js`
carries its own checks:

- **Honeypot** — a hidden `bot-field`; if it's filled, the submission is
  dropped and a 200 is returned so bots don't retry.
- **Length cap** — details over 5,000 characters are rejected.
- **Link heuristic** — more than 3 URLs in the details field is dropped.
- **Form allowlist** — only the six known form names are accepted.

If spam ever becomes a real problem, add a timestamp field to the form and
reject anything submitted in under ~3 seconds.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Rows never appear | `APPS_SCRIPT_URL` isn't set in Netlify, deployment isn't "Anyone" access, or the URL is the `/dev` one instead of `/exec` |
| Form says "That didn't go through" | Check Netlify → Logs → Functions → `feedback` for the actual error |
| Rows land only on "Other" | Form name didn't match — check the `TABS` map in `Code.gs` against Netlify's form names |
| Nothing after editing the script | Apps Script serves the *deployed* version. **Deploy → Manage deployments → ✏️ → Version: New version** |
| Want to see errors | Apps Script → **Executions** shows every call and its logs |
| Duplicate rows | Already handled — `alreadyProcessed()` drops repeats using the Netlify submission id. Apps Script replies with a 302 and Netlify retries on it, so without the check one submission writes several rows. |
