// Netlify Function: proxy the NYMC Trumba ICS feed with CORS headers.
//
// Deploy: drop this file at /netlify/functions/nymc-events.js in your repo,
// commit, push. Netlify auto-detects functions in this folder.
//
// Then in index.html, swap the JS from:
//   const NYMC_ICS = "https://corsproxy.io/?url=" + encodeURIComponent(NYMC_ICS_RAW);
// to:
//   const NYMC_ICS = "/.netlify/functions/nymc-events";
//
// Why bother? corsproxy.io is fine but adds a third-party dependency and
// occasionally rate-limits. This function runs on Netlify's edge for free
// (125k invocations/mo on the free tier) and gives you a stable, cached feed.

const TRUMBA_URL = "https://www.trumba.com/calendars/new-york-medical-college.ics";

exports.handler = async () => {
  try {
    const upstream = await fetch(TRUMBA_URL);
    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        body: `Upstream returned ${upstream.status}`,
      };
    }
    const text = await upstream.text();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        // Cache at Netlify's edge for 10 minutes so we're not hammering Trumba
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `Failed to fetch upstream: ${err.message}`,
    };
  }
};
