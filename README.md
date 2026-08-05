# NYMC School of Medicine Student Senate — website

The student hub for NYMC SOM: resources by class year, one smart-routing
feedback form, the senate directory, all 133 clubs, live NYMC events, and
quick contacts.

**Live preview:** https://inquisitive-kheer-2e1e5d.netlify.app/

## What's in the repo

```
index.html                      ← the entire site (single file, no build step)
netlify.toml                    ← Netlify config (functions dir + redirects)
netlify/functions/nymc-events.js ← proxies the NYMC Trumba calendar (CORS + cache)
```

## Hosting: Netlify (required, not optional)

Two features only work on Netlify:

- **Feedback form** → Netlify Forms (six per-category forms; submissions
  land in the Netlify dashboard, one notification email per category)
- **NYMC events calendar** → the serverless function above (Trumba's feed
  blocks browser CORS, so we proxy it)

GitHub Pages can serve the HTML but **cannot** run either feature — the
calendar would error and form submissions would fail. Keep hosting on
Netlify; use GitHub as the source of truth.

## Recommended setup: auto-deploy from GitHub

1. In the Netlify dashboard → your site → **Site configuration →
   Build & deploy → Link repository** → pick this GitHub repo.
2. Build settings: no build command · publish directory `.` (root).
3. From then on, **every push to `main` auto-deploys** in ~30 seconds.
   No more drag-and-drop.

## One-time Netlify checks after first deploy

1. **Forms** — verify six forms appear (feedback-housing, -cafeteria,
   -facilities, -year, -curriculum, -other), then add one email
   notification per form: **Notifications → Form submission
   notifications**. This is the routing.
2. **Functions** — confirm `nymc-events` deployed; the home-page
   calendar should show upcoming NYMC events within seconds.
3. Free-tier limits: 100 form submissions/mo, 125k function calls/mo.

## Editing content

Open `index.html` and search **`EDIT HERE`** — every swap-in point is
marked: senator roster, club list, event sources, analytics. Current
data: real 16-senator roster (class years + emails), real 133-club list
with contacts and missions, migrated committee pages, offices/contacts,
and club leader forms.

Still placeholder: Resources year-tab links (M1–M4 study materials),
meeting minutes, "What we're working on" initiatives, marketplace
listings, "Ask me about" senator lines, committee rosters for 2026–27.

## Branding

Palette lives in CSS variables at the top of `index.html`:

```css
--primary: #7E2D40;   /* maroon — verify against NYMC style guide */
--accent:  #C8A24C;   /* gold */
```

## Custom domain (later)

Buy/choose a domain → Netlify dashboard → **Domain management → Add a
domain**. Netlify handles DNS + HTTPS automatically.

## Maintainers

Update the senator roster each spring after elections and the club list
each fall (Dean Sozzo / Treasurer has the approved list). Site questions:
Dliu4@student.nymc.edu (Outreach Coordinator).

Code is MIT-licensed — adapt freely for other student governments.
