/**
 * TrustTargets contact form → Google Sheets
 *
 * Setup:
 * 1. Create a Google Sheet (e.g. "TrustTargets contact submissions").
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL into site/.env as VITE_GOOGLE_SHEETS_SCRIPT_URL
 *    and GitHub secret VITE_GOOGLE_SHEETS_SCRIPT_URL for production builds.
 */

var SHEET_NAME = "Submissions";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheet = getSheet_();
    ensureHeaders_(sheet);

    sheet.appendRow([
      new Date(),
      String(payload.name || "").trim(),
      String(payload.email || "").trim(),
      String(payload.phone || "").trim(),
      String(payload.message || "").trim(),
    ]);

    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function getSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Submitted at", "Name", "Email", "Phone", "Message"]);
    sheet.setFrozenRows(1);
  }
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
