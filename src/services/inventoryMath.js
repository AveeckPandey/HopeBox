// General inventory math. The data model uses a `contents` map
// (commodityId → qty) on both Box and Inventory documents. Anything
// that needs to add, subtract, compare, or summarize quantities
// across both documents goes through this file so the arithmetic
// stays consistent in one place.
//
// Pure functions only — no Firestore imports. The caller (a screen
// or service) is responsible for opening the transaction and writing
// the result. This file stays unit-testable in node without
// initializing Firebase.

// Return a fresh empty contents map. Useful when initializing a
// brand-new inventory doc.
export function emptyContents() {
  return {};
}

// Add two contents maps: {a:1, b:2} + {b:3, c:4} = {a:1, b:5, c:4}
export function addContents(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = (Number(out[k]) || 0) + Number(v);
  }
  return out;
}

// Subtract b from a. Returns a new map; never mutates inputs.
export function subContents(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = (Number(out[k]) || 0) - Number(v);
  }
  return out;
}

// Scale a contents map by a number. Used for box templates
// ("20 boxes × Standard = 200kg rice").
export function scaleContents(map, factor) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) {
    out[k] = (Number(v) || 0) * factor;
  }
  return out;
}

// How many copies of `templateCommodities` can the current `inventoryContents`
// support? Min of floor(qty/required) across all template commodities.
// Returns 0 if any required commodity is missing from inventory.
export function possibleBoxesFromTemplate(inventoryContents, templateCommodities) {
  let n = Infinity;
  for (const [id, required] of Object.entries(templateCommodities || {})) {
    const req = Number(required);
    if (!req || req <= 0) continue;
    const have = Number(inventoryContents?.[id] ?? 0);
    n = Math.min(n, Math.floor(have / req));
  }
  return Number.isFinite(n) ? Math.max(n, 0) : 0;
}

// Per-commodity shortage for a target box count. Returns a map of
// commodityId → (required - onHand), with 0 for any commodity that
// already meets/exceeds its target.
export function shortageForTarget(inventoryContents, templateCommodities, targetBoxes) {
  const out = {};
  const t = Math.max(Number(targetBoxes) || 0, 0);
  for (const [id, required] of Object.entries(templateCommodities || {})) {
    const need = (Number(required) || 0) * t;
    const have = Number(inventoryContents?.[id] ?? 0);
    out[id] = Math.max(need - have, 0);
  }
  return out;
}

// Apply a box's contents to inventory. The semantics of dispatch
// and return are the same arithmetic: dispatch subtracts the box's
// contents from inventory, return adds them back. We express it as
// `direction = -1` for dispatch, `+1` for return.
//
// Returns the *new* inventory contents map.
//
// The caller is responsible for opening the Firestore transaction
// and writing the result. This pure function exists so the math
// is testable in isolation.
export function applyBoxToInventory(inventoryContents, boxContents, direction) {
  const sign = direction === 'dispatch' ? -1 : 1;
  const delta = scaleContents(boxContents || {}, sign);
  return addContents(inventoryContents, delta);
}

// If the new inventory map would push any commodity negative, return
// the offending {commodityId: resultingQty}. Otherwise null.
export function findNegativeQuantities(newContents) {
  const negs = {};
  for (const [k, v] of Object.entries(newContents || {})) {
    if (Number(v) < 0) negs[k] = v;
  }
  return Object.keys(negs).length ? negs : null;
}

// FEFO (First Expiry First Out): given an inventory map of
//   { commodityId: { totalQty, lots: [{ batchNumber, qty, expiryDate }] } }
// pick the lot with the earliest non-null expiryDate, or the lot
// with the largest qty if no expiry dates are present.
//
// Returns the chosen lot object, or null if no lots are available.
//
// The caller is expected to call this once per commodity line when
// computing a dispatch, and decrement that lot's qty by the
// dispatch amount. The inventory doc shape in v2.0 is intentionally
// flat (a contents map) — FEFO lives at the *box* level (each box
// records its own batch + expiry) and the lot inventory is a
// derived view, not a stored field.
export function pickFefoLot(lots) {
  if (!Array.isArray(lots) || lots.length === 0) return null;
  const withExpiry = lots.filter((l) => l.expiryDate);
  if (withExpiry.length > 0) {
    return withExpiry.sort((a, b) => {
      const da = a.expiryDate?.toMillis?.() ?? new Date(a.expiryDate).getTime();
      const db = b.expiryDate?.toMillis?.() ?? new Date(b.expiryDate).getTime();
      return da - db;
    })[0];
  }
  return lots.sort((a, b) => (b.qty || 0) - (a.qty || 0))[0];
}

// Build the per-line totals for a target box count. Used by the
// dashboard chart. `inventoryContents` is the live inventory map,
// `templateCommodities` is the default box template's commodity map.
export function chartRowsForTemplate(inventoryContents, templateCommodities) {
  return Object.entries(templateCommodities || {}).map(([id, required]) => ({
    commodityId: id,
    requiredPerBox: Number(required) || 0,
    onHand: Number(inventoryContents?.[id] ?? 0),
  }));
}

// FEFO helper: among the *boxes* in a warehouse that contain a given
// commodity, return the ones with the earliest expiry date, sorted
// ascending. Boxes without an expiry date on the commodity line
// sort last. This is the per-warehouse view used by the
// "expiring soon" alert on the dashboard.
export function boxesByEarliestExpiry(boxes, commodityId) {
  return boxes
    .filter((b) => b.contents?.[commodityId]?.expiryDate)
    .sort((a, b) => {
      const da = a.contents[commodityId].expiryDate?.toMillis?.()
        ?? new Date(a.contents[commodityId].expiryDate).getTime();
      const db = b.contents[commodityId].expiryDate?.toMillis?.()
        ?? new Date(b.contents[commodityId].expiryDate).getTime();
      return da - db;
    });
}
