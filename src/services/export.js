import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// --- escaping helpers -------------------------------------------------
//
// Anything we render in a PDF (HTML interpolation) or write to a CSV
// must be escaped, or a user-controlled field (donor name, audit log
// value, etc.) can inject markup / spreadsheet formulas / extra rows.

// HTML escape for PDF table cells. Covers the five characters that
// matter for cell text + attribute contexts.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// CSV cell escape. RFC 4180 wraps a cell in double-quotes and
// doubles any internal quote. We additionally guard against CSV
// formula injection: a cell that begins with `=`, `+`, `-`, `@`,
// a tab, or a CR will be reinterpreted by Excel/Sheets as a
// formula. Prefixing a single apostrophe neutralizes the formula
// while remaining human-readable when the cell is opened in a
// plain text editor.
function escapeCsv(value) {
  const str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export const exportToCSV = async (data, filename = "export") => {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => escapeCsv(row[h])).join(",")
    )
  ];

  const csvString = csvRows.join("\n");
  const fileUri = `${filename}.csv`;

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const { FileSystem } = await import("expo-file-system");
    const path = FileSystem.documentDirectory + fileUri;
    await FileSystem.writeAsStringAsync(path, csvString);
    await Sharing.shareAsync(path, {
      dialogTitle: `Save ${filename}`,
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text"
    });
  }

  return csvString;
};

export const exportToPDF = async (data, title = "Report", filename = "report") => {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  // `title` is a developer-controlled label (caller passes a known
  // string), but we escape it anyway so future callers can pass
  // user-controlled titles safely.
  const safeTitle = escapeHtml(title);
  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 22px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #D1D5DB; padding: 8px 12px; text-align: left; font-size: 12px; }
          th { background: #F3F4F6; font-weight: 700; }
          tr:nth-child(even) { background: #F9FAFB; }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${data.map((row) =>
              `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`
            ).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  await Print.printAsync({ html });
};

// --- donor-format exports --------------------------------------------
//
// NGO grants typically require reporting distribution in a donor-
// specific column shape. We support two common ones out of the box;
// adding a third is a one-function change in this file.
//
// `dispatchedBoxes` is the input — an array of box records that
// have been dispatched (status === 'dispatched'). Each box is
// expected to have:
//   id, status, warehouseId, donorName, donorContact,
//   recipient, location, dispatchedAt (Firestore Timestamp or string),
//   contents (map of commodityId → qty), category
// plus the box's own per-line commodity details if you want
// per-item visibility (the ECHO format wants the commodity
// breakdown).
//
// ECHO columns (EUDirect / ECHO Single Form, simplified):
//   Reference, DistributionDate, BeneficiaryName, BeneficiaryContact,
//   Location, ItemType, Quantity, Unit, Donor
//
// USAID columns (FFP-style reporting, simplified):
//   BoxID, Date, Region, Beneficiary, Commodity, Qty, Unit,
//   Donor, ValueUSD
//
// Both writers are CSV-only by design — donor portals accept CSV
// and reject PDF. Output is escaped through the same `escapeCsv`
// helper, so user-controlled fields can never inject a formula.

// Pick a representative date for the box. The box record may have
// a `dispatchedAt` (Firestore timestamp), a `createdAt`, or nothing.
// Fall back to "unknown" so the column is never blank — donors
// reject rows with missing dates.
function pickDate(box) {
  const ts = box.dispatchedAt || box.dispatchedOn || box.dispatched_at || box.createdAt;
  if (!ts) return "unknown";
  if (typeof ts === "string") return ts.slice(0, 10);
  if (ts.toDate) return ts.toDate().toISOString().slice(0, 10);
  if (ts instanceof Date) return ts.toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}

function pickCommodityBreakdown(box) {
  // The contents map can be either a flat {id: qty} or a richer
  // {id: { qty, ... }} shape. We accept both.
  const contents = box.contents || {};
  const lines = [];
  for (const [id, value] of Object.entries(contents)) {
    const qty = typeof value === "object" && value !== null ? Number(value.qty) || 0 : Number(value) || 0;
    if (qty > 0) {
      lines.push({
        id,
        qty,
        unit: value && typeof value === "object" ? value.unit || "" : "",
        name: value && typeof value === "object" ? value.name || id : id,
      });
    }
  }
  // If the box is the legacy shape with top-level rice/dal/sachets
  // fields, surface them so the report still has content.
  if (lines.length === 0) {
    for (const k of ["rice", "dal", "sachets"]) {
      const v = Number(box[k]);
      if (v) lines.push({ id: k, qty: v, unit: k === "sachets" ? "sachet" : "kg", name: k });
    }
  }
  return lines;
}

export const exportToEchoCSV = async (dispatchedBoxes, filename = "echo-distribution") => {
  if (!dispatchedBoxes || !dispatchedBoxes.length) return null;
  const ECHO_HEADERS = [
    "Reference", "DistributionDate", "BeneficiaryName", "BeneficiaryContact",
    "Location", "ItemType", "Quantity", "Unit", "Donor",
  ];
  const rows = [ECHO_HEADERS.join(",")];
  for (const box of dispatchedBoxes) {
    const date = pickDate(box);
    const lines = pickCommodityBreakdown(box);
    // If a box has no per-commodity breakdown, fall back to a single
    // row keyed by box id so the box is still reported.
    if (lines.length === 0) {
      rows.push([
        box.id, date, box.recipient || "", box.recipientContact || "",
        box.location || box.warehouseId || "", "Standard box", 1, "box", box.donorName || "",
      ].map(escapeCsv).join(","));
      continue;
    }
    for (const line of lines) {
      rows.push([
        box.id, date, box.recipient || "", box.recipientContact || "",
        box.location || box.warehouseId || "", line.name || line.id,
        line.qty, line.unit || "", box.donorName || "",
      ].map(escapeCsv).join(","));
    }
  }
  const csv = rows.join("\n");
  const fileUri = `${filename}.csv`;
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const { FileSystem } = await import("expo-file-system");
    const path = FileSystem.documentDirectory + fileUri;
    await FileSystem.writeAsStringAsync(path, csv);
    await Sharing.shareAsync(path, {
      dialogTitle: `Save ${filename}`,
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
    });
  }
  return csv;
};

export const exportToUsaidCSV = async (dispatchedBoxes, filename = "usaid-distribution") => {
  if (!dispatchedBoxes || !dispatchedBoxes.length) return null;
  const USAID_HEADERS = [
    "BoxID", "Date", "Region", "Beneficiary", "Commodity",
    "Qty", "Unit", "Donor", "ValueUSD",
  ];
  const rows = [USAID_HEADERS.join(",")];
  for (const box of dispatchedBoxes) {
    const date = pickDate(box);
    const lines = pickCommodityBreakdown(box);
    const valuePerBox = Number(box.valueUSD) || "";
    if (lines.length === 0) {
      rows.push([
        box.id, date, box.region || box.warehouseId || "",
        box.recipient || "", "Standard box", 1, "box", box.donorName || "", valuePerBox,
      ].map(escapeCsv).join(","));
      continue;
    }
    for (const line of lines) {
      rows.push([
        box.id, date, box.region || box.warehouseId || "",
        box.recipient || "", line.name || line.id,
        line.qty, line.unit || "", box.donorName || "", valuePerBox,
      ].map(escapeCsv).join(","));
    }
  }
  const csv = rows.join("\n");
  const fileUri = `${filename}.csv`;
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const { FileSystem } = await import("expo-file-system");
    const path = FileSystem.documentDirectory + fileUri;
    await FileSystem.writeAsStringAsync(path, csv);
    await Sharing.shareAsync(path, {
      dialogTitle: `Save ${filename}`,
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
    });
  }
  return csv;
};
