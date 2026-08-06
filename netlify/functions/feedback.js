/**
 * Feedback intake — forwards submissions to the Google Sheets Apps Script.
 *
 * Why this exists instead of posting straight to Apps Script from the page:
 * Apps Script doesn't send CORS headers, so a browser fetch can send the
 * request but can't read the reply. Going through this function keeps the
 * request same-origin, so the site gets a real status code and can show an
 * honest success or error state.
 *
 * It also sidesteps Netlify Forms' 100-submissions/month free-tier cap.
 * Netlify Functions allow 125k invocations/month, which this will never
 * approach.
 *
 * SETUP: the Apps Script URL lives in a Netlify environment variable, not in
 * this repo — the repo is public and the endpoint accepts writes.
 *   Netlify → Site configuration → Environment variables → Add:
 *     Key:   APPS_SCRIPT_URL
 *     Value: https://script.google.com/macros/s/…/exec
 * Redeploy after adding it.
 */

const ALLOWED_FORMS = new Set([
  "feedback-housing",
  "feedback-cafeteria",
  "feedback-facilities",
  "feedback-year",
  "feedback-curriculum",
  "feedback-other",
]);

const MAX_DETAILS = 5000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const endpoint = process.env.APPS_SCRIPT_URL;
  if (!endpoint) {
    console.error("APPS_SCRIPT_URL is not set");
    return json(500, { ok: false, error: "Server not configured" });
  }

  let fields;
  try {
    fields = Object.fromEntries(new URLSearchParams(event.body || ""));
  } catch (err) {
    return json(400, { ok: false, error: "Malformed body" });
  }

  // Honeypot: real people never fill this in. Answer 200 so bots think they
  // succeeded and don't bother retrying.
  if (fields["bot-field"]) {
    console.log("Honeypot tripped — dropping submission");
    return json(200, { ok: true });
  }

  const formName = fields["form-name"] || "";
  if (!ALLOWED_FORMS.has(formName)) {
    return json(400, { ok: false, error: "Unknown form" });
  }

  // Cheap spam heuristics, standing in for Netlify's Akismet
  const details = fields.details || "";
  if (details.length > MAX_DETAILS) {
    return json(400, { ok: false, error: "Details too long" });
  }
  const linkCount = (details.match(/https?:\/\//gi) || []).length;
  if (linkCount > 3) {
    console.log("Dropped: too many links in details");
    return json(200, { ok: true });
  }

  const payload = {
    form_name: formName,
    created_at: new Date().toISOString(),
    id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    data: {
      category: fields.category || "",
      reason: fields.reason || "",
      details,
      class_year: fields.class_year || "",
      follow_up: fields.follow_up || "no",
      email: fields.email || "",
      routed_to: fields.routed_to || "",
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow", // Apps Script answers with a 302
    });

    if (!res.ok) {
      console.error("Apps Script returned", res.status);
      return json(502, { ok: false, error: "Upstream error" });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("Failed to reach Apps Script:", err.message);
    return json(502, { ok: false, error: "Could not reach the sheet" });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
