/**
 * TrustTargets / EventIQN contact + waitlist forms → Google Sheets
 *
 * Setup:
 * 1. Create a Google Sheet (e.g. "TrustTargets contact submissions").
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL into site/.env and web/.env as VITE_GOOGLE_SHEETS_SCRIPT_URL
 *    and GitHub secret VITE_GOOGLE_SHEETS_SCRIPT_URL for production builds.
 * 5. After changing this script, redeploy the web app (new version).
 *
 * Worksheets:
 * - Submissions (default): contact form — Submitted at, Name, Email, Phone, Message
 * - EventIQNWaitlist: homepage waitlist — Submitted at, Name, Email, Phone, Organization, Message
 */

var DEFAULT_SHEET = "Submissions";
var WAITLIST_SHEET = "EventIQNWaitlist";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = String(payload.sheet || payload.form || DEFAULT_SHEET).trim();
    if (sheetName === "eventiqn-waitlist") sheetName = WAITLIST_SHEET;
    if (sheetName !== WAITLIST_SHEET) sheetName = DEFAULT_SHEET;

    var sheet = getSheetByName_(sheetName);
    ensureHeaders_(sheet, sheetName);

    if (sheetName === WAITLIST_SHEET) {
      sheet.appendRow([
        new Date(),
        String(payload.name || "").trim(),
        String(payload.email || "").trim(),
        String(payload.phone || "").trim(),
        String(payload.organization || payload.company || "").trim(),
        String(payload.message || "").trim(),
      ]);
    } else {
      sheet.appendRow([
        new Date(),
        String(payload.name || "").trim(),
        String(payload.email || "").trim(),
        String(payload.phone || "").trim(),
        String(payload.message || "").trim(),
      ]);
    }

    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function getSheetByName_(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function ensureHeaders_(sheet, sheetName) {
  if (sheet.getLastRow() === 0) {
    if (sheetName === WAITLIST_SHEET) {
      sheet.appendRow(["Submitted at", "Name", "Email", "Phone", "Organization", "Message"]);
    } else {
      sheet.appendRow(["Submitted at", "Name", "Email", "Phone", "Message"]);
    }
    sheet.setFrozenRows(1);
  }
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
