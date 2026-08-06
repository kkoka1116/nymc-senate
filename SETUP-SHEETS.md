# Routing feedback into Google Sheets

> **Status: live.** Sheet "NYMC Senate — Feedback", Apps Script deployed
> (v2), and the Netlify webhook is wired to *any form*. Verified
> end-to-end on Aug 6, 2026. The steps below document how it was built
> and how to rebuild or hand it off.

Every feedback submission lands on its own tab — Housing, Cafeteria,
Facilities, Class Year, Curriculum, Other — plus an **All Submissions**
master tab for trend analysis.

```
Student submits  →  Netlify Forms  →  outgoing webhook  →  Apps Script  →  Google Sheet
                    (spam filter,                          (routes by
                     dashboard, backup)                     form name)
```

Netlify stays in the loop, so you keep spam filtering, the dashboard, and
a second copy of every submission if the Sheet ever breaks.

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

### 5. Point Netlify at it

Netlify dashboard → your site → **Forms → Form notifications → Add
notification → Outgoing webhook**:

- **Event to listen for:** New form submission
- **URL to notify:** the `/exec` URL from step 4
- **Form:** pick one

Save, then repeat for each of the six forms (same URL every time — the
script reads the form name from the payload and routes it).

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

## If you outgrow Netlify Forms

Netlify's free tier allows **100 submissions/month** across all forms.
For a school this size that may not last. Two options when you hit it:

**a) Pay** — Netlify Level 1 is $19/month for 1,000 submissions.

**b) Skip Netlify Forms and post straight to Apps Script (free, unlimited).**
In `index.html`, find `submitFb()` and change the fetch target:

```js
// from
const res = await fetch('/', { … });

// to
const res = await fetch('https://script.google.com/macros/s/YOUR_ID/exec', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: payload.toString(),
});
```

`Code.gs` already accepts that format — no script changes needed. You'd
lose Netlify's spam filtering and dashboard, so keep the honeypot field
in place if you switch.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Rows never appear | Deployment isn't "Anyone" access, or the webhook URL is the `/dev` URL instead of `/exec` |
| Rows land only on "Other" | Form name didn't match — check the `TABS` map in `Code.gs` against Netlify's form names |
| Nothing after editing the script | Apps Script serves the *deployed* version. **Deploy → Manage deployments → ✏️ → Version: New version** |
| Want to see errors | Apps Script → **Executions** shows every call and its logs |
| Duplicate rows | Already handled — `alreadyProcessed()` drops repeats using the Netlify submission id. Apps Script replies with a 302 and Netlify retries on it, so without the check one submission writes several rows. |
