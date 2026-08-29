// Unit conversion for commodity quantities.
//
// The data model stores everything in the commodity's `unit` (kg, L,
// tablet, pack, vial, unit). In the field, staff often need to enter
// a box line as "2 packs" when the catalog says "tablet" — they
// shouldn't have to do the mental math (1 pack = 24 tablets).
//
// `unitConversion` on a commodity looks like:
//   { pack: 24, carton: 480 }   // one pack = 24 units, one carton = 480
//
// The unit values are *multipliers* — a "1 pack" row in a box
// contributes 24 tablets to the contents map. The dashboard's
// `possibleBoxesFromTemplate` therefore sees tablets, not packs,
// and the chart is consistent.
//
// We also expose a display converter so the UI can show "2 packs
// (48 tablets)" when relevant. This is purely presentational —
// the stored value is always the canonical unit count.

const UNIT_KINDS = {
  // Mass
  kg: 'mass',
  g: 'mass',
  // Volume
  L: 'volume',
  ml: 'volume',
  // Discrete counts
  tablet: 'count',
  vial: 'count',
  unit: 'count',
  pack: 'count',
  carton: 'count',
  sachet: 'count',
};

const MASS_BASE = { kg: 1, g: 0.001 };
const VOLUME_BASE = { L: 1, ml: 0.001 };

// Convert a quantity from `from` unit to `to` unit, both of which
// must reference the same base. Returns null if the conversion is
// not possible (different unit kinds, unknown unit). The result is
// rounded to a sensible number of decimals (4 — handles mg↔kg).
export function convert(qty: number | string, from: string, to: string): number | null {
  const n = Number(qty);
  if (!Number.isFinite(n)) return null;
  if (from === to) return n;
  const fromKind = UNIT_KINDS[from as keyof typeof UNIT_KINDS];
  const toKind = UNIT_KINDS[to as keyof typeof UNIT_KINDS];
  if (!fromKind || !toKind || fromKind !== toKind) return null;

  if (fromKind === 'mass') return roundTo(n * (MASS_BASE[from as keyof typeof MASS_BASE] || 0) / (MASS_BASE[to as keyof typeof MASS_BASE] || 1), 4);
  if (fromKind === 'volume') return roundTo(n * (VOLUME_BASE[from as keyof typeof VOLUME_BASE] || 0) / (VOLUME_BASE[to as keyof typeof VOLUME_BASE] || 1), 4);
  // count: 1:1
  return n;
}

// Apply the commodity's `unitConversion` table to a quantity
// entered in a non-canonical unit. Example:
//   commodity.unit = 'tablet', unitConversion = { pack: 24 }
//   applyUnitConversion(2, 'pack', commodity) → 48
// Returns the original quantity if no conversion is defined for
// `fromUnit`, so unknown units degrade to identity.
export function applyUnitConversion(
  qty: number | string,
  fromUnit: string,
  commodity: { unitConversion?: Record<string, number> } | null | undefined
): number {
  const table = commodity?.unitConversion;
  if (!table || !fromUnit) return Number(qty) || 0;
  const factor = table[fromUnit];
  if (!factor) return Number(qty) || 0;
  return (Number(qty) || 0) * Number(factor);
}

// Build the inverse table for display. Given the same commodity,
// `inverseConversions` returns { pack: 24 } but expressed as the
// *number of packs per tablet*, useful for "24 tablets = 1 pack"
// labels. We don't actually need this for the dispatch path, but
// the AddBox/EditBox screens can use it to show conversion hints
// inline next to the qty field.
export function listConversions(
  commodity: { unitConversion?: Record<string, number> } | null | undefined
): { unit: string; factor: number; kind: string }[] {
  const table = commodity?.unitConversion || {};
  return Object.entries(table).map(([unit, factor]) => ({
    unit,
    factor: Number(factor) || 0,
    kind: UNIT_KINDS[unit as keyof typeof UNIT_KINDS] || 'unknown',
  }));
}

export function getUnitKind(unit: string): string {
  return UNIT_KINDS[unit as keyof typeof UNIT_KINDS] || 'unknown';
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export default {
  convert,
  applyUnitConversion,
  listConversions,
  getUnitKind,
};
