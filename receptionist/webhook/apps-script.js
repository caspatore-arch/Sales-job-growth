/**
 * Call log webhook for the AI receptionist (Google Apps Script).
 *
 * Every analyzed call lands as a row in the client's Google Sheet — no server to host.
 *
 * Setup (once per client, ~3 minutes):
 * 1. Create a new Google Sheet named e.g. "Acme — Receptionist Call Log".
 * 2. Extensions → Apps Script, delete the boilerplate, paste this whole file.
 * 3. Deploy → New deployment → type "Web app":
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. Copy the web app URL (https://script.google.com/macros/s/.../exec)
 *    into the client's config as actions.webhook_url, then re-run deploy.
 */

var SHEET_NAME = "Calls";

var HEADERS = [
  "Time",
  "Caller name",
  "Callback number",
  "From number",
  "Reason",
  "Appointment requested",
  "Message",
  "Call summary",
  "Duration (s)",
  "Call ID",
];

function doPost(e) {
  var body = JSON.parse(e.postData.contents);

  // Retell sends call_started / call_ended / call_analyzed; only the last has analysis data.
  if (body.event !== "call_analyzed") {
    return ContentService.createTextOutput("ignored");
  }

  var call = body.call || {};
  var analysis = (call.call_analysis && call.call_analysis.custom_analysis_data) || {};
  var summary = (call.call_analysis && call.call_analysis.call_summary) || "";

  var durationSeconds = "";
  if (call.start_timestamp && call.end_timestamp) {
    durationSeconds = Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  }

  var sheet = getOrCreateSheet_();
  sheet.appendRow([
    new Date(),
    analysis.caller_name || "",
    analysis.callback_number || "",
    call.from_number || "",
    analysis.call_reason || "",
    analysis.appointment_requested === true ? "YES" : "no",
    analysis.message || "",
    summary,
    durationSeconds,
    call.call_id || "",
  ]);

  return ContentService.createTextOutput("ok");
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}
