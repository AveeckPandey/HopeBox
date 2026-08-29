// Box line items. With configurable commodities, the line item for
// a single commodity carries optional batch + expiry info so we can
// support FEFO and donor compliance (ECHO/USAID/ICRC/UNFPA).
//
// A `box.contents` map is a record of:
//
//   { [commodityId]: qty }
//
// for the simple "no batch" case, OR
//
//   { [commodityId]: { qty, batchNumber?, expiryDate?, manufacturingDate? } }
//
// when batch or expiry tracking is on for that commodity. We accept
// both shapes everywhere; the helpers below normalize + validate.

// A line value is "flat" if it is a number; otherwise it's an object.
export function isFlatLine(v) {
  return typeof v === 'number';
}

// Normalize a single line value to a {qty, batchNumber, expiryDate,
// manufacturingDate} object. If the input is a number, all optional
// fields stay null.
export function normalizeLine(v) {
  if (v == null) return { qty: 0, batchNumber: null, expiryDate: null, manufacturingDate: null };
  if (typeof v === 'number' || typeof v === 'string') {
    // Firestore sometimes returns numeric fields as strings
    // (notably legacy docs and certain query paths). The
    // inventoryMath layer coerces with `Number(v) || 0`, but if
    // we lose the value here, downstream math sees 0 — silent
    // data loss. Coerce explicitly.
    const n = Number(v);
    return { qty: Number.isFinite(n) ? n : 0, batchNumber: null, expiryDate: null, manufacturingDate: null };
  }
  return {
    qty: Number(v.qty ?? 0),
    batchNumber: v.batchNumber ?? null,
    expiryDate: v.expiryDate ?? null,
    manufacturingDate: v.manufacturingDate ?? null,
  };
}

// Total qty for a commodity line, regardless of shape.
export function lineQty(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return Number(v.qty) || 0;
}

// Total qty across a whole contents map.
export function totalContents(contents) {
  let sum = 0;
  for (const v of Object.values(contents || {})) sum += lineQty(v);
  return sum;
}

// Reduce a contents map to a flat `{ commodityId: qty }` map. Drops
// the batch/expiry metadata. Used for inventory math and exports.
export function flattenContents(contents) {
  const out = {};
  for (const [k, v] of Object.entries(contents || {})) {
    out[k] = lineQty(v);
  }
  return out;
}

// Validate a contents map against a list of commodities. Returns a
// list of human-readable error messages (empty if valid). Caller
// shows the list and blocks the submit if non-empty.
//
//   validateContents(box.contents, commodities, { strict: true })
//
// `strict: true` requires every required commodity to have qty > 0.
// `strict: false` only checks for malformed shapes.
export function validateContents(contents, commodities, { strict = true } = {}) {
  const errors = [];
  const map = contents || {};
  const byId = {};
  for (const c of commodities || []) byId[c.id] = c;

  for (const [commodityId, raw] of Object.entries(map)) {
    const commodity = byId[commodityId];
    if (!commodity) {
      errors.push(`Unknown commodity: ${commodityId}`);
      continue;
    }
    const line = normalizeLine(raw);
    if (!Number.isFinite(line.qty) || line.qty < 0) {
      errors.push(`${commodity.name}: quantity must be a non-negative number.`);
    }
    if (commodity.expiryTracking && !line.expiryDate && line.qty > 0) {
      errors.push(`${commodity.name}: expiry date is required.`);
    }
    if (commodity.batchTracking && !line.batchNumber && line.qty > 0) {
      errors.push(`${commodity.name}: batch number is required.`);
    }
  }

  if (strict) {
    for (const c of commodities || []) {
      if (!c.required) continue;
      const qty = lineQty(map[c.id]);
      if (qty <= 0) {
        errors.push(`${c.name}: required commodity is missing.`);
      }
    }
  }
  return errors;
}
