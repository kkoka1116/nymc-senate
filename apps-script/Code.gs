/**
 * NYMC Student Senate — feedback → Google Sheets router
 * =====================================================
 *
 * Receives feedback submissions and files each one on its own tab,
 * plus a master log. Works two ways:
 *
 *   1. Netlify outgoing webhook (recommended — see SETUP-SHEETS.md)
 *      Netlify POSTs JSON here after each form submission.
 *
 *   2. Direct POST from the website (form-urlencoded)
 *      Used if you ever outgrow Netlify Forms' 100 submissions/month.
 *
 * Both paths land in the same place. No code changes needed to switch.
 *
 * SETUP: see SETUP-SHEETS.md in the repo. Short version —
 *   Extensions → Apps Script → paste this → Run `setupTabs` once →
 *   Deploy → New deployment → Web app → Execute as: Me,
 *   Who has access: Anyone → copy the /exec URL into Netlify.
 */

// ---- Which form goes on which tab -------------------------------------
var TABS = {
  'feedback-housing':    'Housing',
  'feedback-cafeteria':  'Cafeteria',
  'feedback-facilities': 'Facilities',
  'feedback-year':       'Class Year',
  'feedback-curriculum': 'Curriculum',
  'feedback-other':      'Other',
};

var MASTER_TAB = 'All Submissions';

var HEADERS = [
  'Timestamp',
  'Category',
  'Reason',
  'Class Year',
  'Details',
  'Follow-up requested?',
  'Email',
  'Routed to',
  'Form',
  'Netlify ID',
];

// ---- Entry point ------------------------------------------------------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Serialize writes so retries can't interleave
    lock.waitLock(20000);

    var payload = parsePayload(e);
    if (!payload) return json({ ok: false, error: 'no payload' });

    // Apps Script answers with a 302, and Netlify treats that as worth
    // retrying — so the same submission can arrive several times. Skip
    // anything already filed.
    if (alreadyProcessed(payload.id)) {
      return json({ ok: true, skipped: 'duplicate', id: payload.id });
    }

    var row = buildRow(payload);
    var tabName = TABS[payload.formName] || 'Other';

    appendRow(tabName, row);
    appendRow(MASTER_TAB, row);

    return json({ ok: true, tab: tabName });
  } catch (err) {
    // Log to the script's execution log so failures are debuggable
    console.error('Feedback router failed: ' + err);
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (releaseErr) { /* never held */ }
  }
}

/**
 * True if this Netlify submission id has already been filed.
 * Ids are remembered for 6 hours, well past Netlify's retry window.
 */
function alreadyProcessed(id) {
  if (!id) return false;              // no id (direct POST) → always file
  var cache = CacheService.getScriptCache();
  var key = 'sub_' + id;
  if (cache.get(key)) return true;
  cache.put(key, '1', 21600);
  return false;
}

// Lets you sanity-check the deployment in a browser
function doGet() {
  return json({ ok: true, status: 'NYMC Senate feedback router is live' });
}

// ---- Payload handling -------------------------------------------------
function parsePayload(e) {
  if (!e) return null;

  // Path 1: Netlify outgoing webhook → JSON body
  if (e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body && body.data) {
        return {
          formName: body.form_name || '',
          createdAt: body.created_at || '',
          id: body.id || '',
          data: body.data,
        };
      }
      // Some senders post flat JSON
      if (body && body['form-name']) {
        return { formName: body['form-name'], createdAt: '', id: '', data: body };
      }
    } catch (parseErr) {
      // fall through to form-encoded handling
    }
  }

  // Path 2: direct form-urlencoded POST from the site
  if (e.parameter && Object.keys(e.parameter).length) {
    return {
      formName: e.parameter['form-name'] || '',
      createdAt: '',
      id: '',
      data: e.parameter,
    };
  }

  return null;
}

function buildRow(payload) {
  var d = payload.data || {};
  var when = payload.createdAt ? new Date(payload.createdAt) : new Date();

  return [
    when,
    d.category || '',
    d.reason || '',
    d.class_year || '',
    d.details || '',
    (d.follow_up === 'yes') ? 'Yes' : 'No',
    d.email || '',
    d.routed_to || '',
    payload.formName || '',
    payload.id || '',
  ];
}

// ---- Sheet helpers ----------------------------------------------------
function appendRow(tabName, row) {
  var sheet = getOrCreateTab(tabName);
  sheet.appendRow(row);

  // Keep the newest submission visible without manual scrolling
  var last = sheet.getLastRow();
  sheet.getRange(last, 1).setNumberFormat('yyyy-mm-dd hh:mm');
}

function getOrCreateTab(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatHeader(sheet);
  }

  return sheet;
}

function formatHeader(sheet) {
  var header = sheet.getRange(1, 1, 1, HEADERS.length);
  header
    .setFontWeight('bold')
    .setBackground('#7E2D40')   // NYMC maroon
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 150); // Timestamp
  sheet.setColumnWidth(3, 260); // Reason
  sheet.setColumnWidth(5, 420); // Details
  sheet.setColumnWidth(8, 260); // Routed to
  sheet.getRange(1, 5, sheet.getMaxRows(), 1).setWrap(true);
}

// ---- Run this once by hand to create every tab upfront ----------------
function setupTabs() {
  getOrCreateTab(MASTER_TAB);
  Object.keys(TABS).forEach(function (formName) {
    getOrCreateTab(TABS[formName]);
  });

  // Drop the default empty "Sheet1" if it's still there and unused
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(blank);
  }

  SpreadsheetApp.getUi().alert(
    'Done — created ' + (Object.keys(TABS).length + 1) + ' tabs.\n\n' +
    'Next: Deploy → New deployment → Web app,\n' +
    'Execute as: Me · Who has access: Anyone,\n' +
    'then paste the /exec URL into Netlify.'
  );
}

// ---- Optional: verify the whole path without touching the website -----
function sendTestRow() {
  doPost({
    postData: {
      contents: JSON.stringify({
        form_name: 'feedback-cafeteria',
        created_at: new Date().toISOString(),
        id: 'manual-test',
        data: {
          category: 'cafeteria',
          reason: 'Hours / availability',
          details: 'Test row from Apps Script — safe to delete.',
          class_year: 'M2',
          follow_up: 'no',
          email: '',
          routed_to: 'Facilities Director (cafeteria) + your year rep',
        },
      }),
    },
  });
}

// ---- Small util -------------------------------------------------------
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// One-off cleanup: wipe every data row from every tab (headers stay).
function clearTestRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function (sh) {
    var last = sh.getLastRow();
    if (last > 1) sh.deleteRows(2, last - 1);
  });
}
