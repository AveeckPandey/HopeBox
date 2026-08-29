// Pure HTML template for the printable box QR label.
// Extracted from PrintQR.js so designers can iterate without touching
// component logic.

import { flattenContents } from '../services/inventoryMath';

// Render a "Name: qty unit" row for each line on the box. Falls back
// to the legacy top-level fields if `contents` is missing (boxes
// written by v1.0). We accept a `commodities` lookup so the template
// can show the friendly name + unit instead of a raw commodityId.
function renderContentsRows(item, commodities) {
  const lines = [];
  if (item.contents && Object.keys(item.contents).length > 0) {
    const flat = flattenContents(item.contents);
    for (const [cid, qty] of Object.entries(flat)) {
      if (!qty) continue;
      const meta = commodities?.[cid];
      lines.push(
        `<div><strong>${escapeHtml(meta?.name || cid)}:</strong> ${escapeHtml(String(qty))} ${escapeHtml(meta?.unit || '')}</div>`
      );
    }
  } else {
    // Legacy fields. Render whichever ones the box has.
    if (item.rice != null) lines.push(`<div><strong>Rice:</strong> ${escapeHtml(String(item.rice))} kg</div>`);
    if (item.dal != null) lines.push(`<div><strong>Dal:</strong> ${escapeHtml(String(item.dal))} kg</div>`);
    if (item.sachets != null) lines.push(`<div><strong>Sachets:</strong> ${escapeHtml(String(item.sachets))}</div>`);
  }
  return lines.join('\n            ');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPrintLabelHtml(item, qrDataUrl, commodities = {}) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
        <div style="max-width: 360px; margin: 0 auto; border: 2px solid #1F2937; border-radius: 18px; padding: 24px; text-align: center;">
          <div style="font-size: 12px; letter-spacing: 3px; font-weight: 700; color: #6B7280; margin-bottom: 10px;">QR LABEL</div>
          <div style="font-size: 28px; font-weight: 800; margin-bottom: 18px;">Box ${escapeHtml(item.id)}</div>
          <img src="${qrDataUrl}" style="width: 220px; height: 220px; margin-bottom: 18px;" />
          <div style="font-size: 16px; line-height: 1.8; text-align: left;">
            ${renderContentsRows(item, commodities)}
            ${item.category ? `<div><strong>Category:</strong> ${escapeHtml(item.category)}</div>` : ''}
            ${item.donorName ? `<div><strong>Donor:</strong> ${escapeHtml(item.donorName)}</div>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}
