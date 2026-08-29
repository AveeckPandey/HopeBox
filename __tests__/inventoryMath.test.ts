import {
  addContents,
  subContents,
  scaleContents,
  possibleBoxesFromTemplate,
  shortageForTarget,
  applyBoxToInventory,
  findNegativeQuantities,
  pickFefoLot,
  chartRowsForTemplate,
  boxesByEarliestExpiry,
  type FefoLot,
  type BoxRecord,
} from '../src/services/inventoryMath';

/// <reference path="./jest-globals.d.ts" />
// The functions in inventoryMath are the security- and
// correctness-sensitive core of the app. Dispatch / return flows
// and the FEFO expiry picker both depend on this file's arithmetic
// being exact — a bug here means inventory totals drift, an NGO
// over-dispatches stock it doesn't have, or a box with the earliest
// expiry is shipped last. These tests are deliberately exhaustive
// on the edge cases.
describe('inventoryMath', () => {
  describe('addContents', () => {
    it('adds two maps and returns a new object (no mutation)', () => {
      const a: Record<string, number> = { rice: 5 };
      const b: Record<string, number> = { rice: 3, dal: 2 };
      const out = addContents(a, b);
      expect(out).toEqual({ rice: 8, dal: 2 });
      // Originals must not be touched.
      expect(a).toEqual({ rice: 5 });
      expect(b).toEqual({ rice: 3, dal: 2 });
    });

    it('treats missing keys as 0', () => {
      expect(addContents({ rice: 1 }, { dal: 2 })).toEqual({ rice: 1, dal: 2 });
      expect(addContents({}, { rice: 1 })).toEqual({ rice: 1 });
    });

    it('coerces stringified numbers (Firestore sometimes returns strings)', () => {
      // Firestore returns numeric fields as `number` in the SDK, but
      // legacy docs and manual imports sometimes have stringified
      // numbers. `addContents` calls `Number(v)` to coerce, so the
      // runtime contract accepts strings; the type system can't
      // express that without changing the production signature.
      expect(
        addContents(
          { rice: '5' as unknown as number },
          { rice: '3' as unknown as number }
        )
      ).toEqual({ rice: 8 });
    });

    it('handles null and undefined inputs without throwing', () => {
      expect(addContents(null, { rice: 1 })).toEqual({ rice: 1 });
      expect(addContents({ rice: 1 }, undefined)).toEqual({ rice: 1 });
    });
  });

  describe('subContents', () => {
    it('subtracts b from a without mutating', () => {
      const a: Record<string, number> = { rice: 5, dal: 2 };
      const out = subContents(a, { rice: 3 });
      expect(out).toEqual({ rice: 2, dal: 2 });
      expect(a).toEqual({ rice: 5, dal: 2 });
    });

    it('returns negative values (caller checks for them with findNegativeQuantities)', () => {
      // We deliberately do NOT clamp here. The dispatch flow
      // (BoxDetails.applyInventoryChange) calls findNegativeQuantities
      // on the result and throws if any line went below zero. If
      // subContents silently clamped, a real oversell would be
      // hidden from the user.
      expect(subContents({ rice: 2 }, { rice: 5 })).toEqual({ rice: -3 });
    });
  });

  describe('scaleContents', () => {
    it('multiplies every qty by a factor', () => {
      expect(scaleContents({ rice: 5, dal: 2 }, 3)).toEqual({ rice: 15, dal: 6 });
    });

    it('scales by zero (clears the map to all-zero)', () => {
      expect(scaleContents({ rice: 5, dal: 2 }, 0)).toEqual({ rice: 0, dal: 0 });
    });

    it('scales by a negative number for dispatch deltas', () => {
      expect(scaleContents({ rice: 5 }, -1)).toEqual({ rice: -5 });
    });
  });

  describe('possibleBoxesFromTemplate', () => {
    it('returns floor of qty/required for the limiting commodity', () => {
      const inv: Record<string, number> = { rice: 100, dal: 30 };
      const tpl: Record<string, number> = { rice: 25, dal: 10 };
      // rice: 100/25=4, dal: 30/10=3 → 3 boxes
      expect(possibleBoxesFromTemplate(inv, tpl)).toBe(3);
    });

    it('returns 0 if any required commodity is missing', () => {
      expect(possibleBoxesFromTemplate({ rice: 100 }, { rice: 25, dal: 10 })).toBe(0);
    });

    it('skips template lines with 0 or missing required qty', () => {
      // A template that says "no required amount" for a line
      // should not block the box count.
      expect(possibleBoxesFromTemplate({ rice: 100 }, { rice: 25, dal: 0 })).toBe(4);
    });

    it('returns 0 for an empty template', () => {
      // Infinity capped to 0 by the `Number.isFinite` branch.
      expect(possibleBoxesFromTemplate({ rice: 100 }, {})).toBe(0);
    });
  });

  describe('shortageForTarget', () => {
    it('returns the per-commodity shortfall for a target box count', () => {
      const inv: Record<string, number> = { rice: 80, dal: 20 };
      const tpl: Record<string, number> = { rice: 25, dal: 10 };
      // need: rice 25*5=125, have 80 → 45 short
      // need: dal  10*5=50,  have 20 → 30 short
      expect(shortageForTarget(inv, tpl, 5)).toEqual({ rice: 45, dal: 30 });
    });

    it('returns 0 (not negative) when a line already meets the target', () => {
      expect(shortageForTarget({ rice: 100 }, { rice: 5 }, 2)).toEqual({ rice: 0 });
    });

    it('clamps target to 0 (no negative shortages when target is 0)', () => {
      expect(shortageForTarget({ rice: 100 }, { rice: 5 }, -3)).toEqual({ rice: 0 });
    });
  });

  describe('applyBoxToInventory (dispatch / return)', () => {
    const box: Record<string, number> = { rice: 10, dal: 5 };

    it('subtracts on dispatch', () => {
      const out = applyBoxToInventory({ rice: 20, dal: 10 }, box, 'dispatch');
      expect(out).toEqual({ rice: 10, dal: 5 });
    });

    it('adds on return', () => {
      const out = applyBoxToInventory({ rice: 20, dal: 10 }, box, 'return');
      expect(out).toEqual({ rice: 30, dal: 15 });
    });

    it('dispatch+return round-trip restores the original inventory', () => {
      const start: Record<string, number> = { rice: 20, dal: 10, sachets: 50 };
      const afterDispatch = applyBoxToInventory(start, box, 'dispatch');
      const afterReturn = applyBoxToInventory(afterDispatch, box, 'return');
      expect(afterReturn).toEqual(start);
    });

    it('handles box with no contents (no-op)', () => {
      expect(applyBoxToInventory({ rice: 20 }, {}, 'dispatch')).toEqual({ rice: 20 });
    });

    it('handles empty inventory (dispatch starts from zero)', () => {
      // Dispatch from a fresh warehouse: every line goes negative.
      // The caller is expected to detect this with findNegativeQuantities
      // and reject the dispatch.
      const out = applyBoxToInventory({}, box, 'dispatch');
      expect(out).toEqual({ rice: -10, dal: -5 });
    });
  });

  describe('findNegativeQuantities', () => {
    it('returns the offending lines, or null when everything is non-negative', () => {
      expect(findNegativeQuantities({ rice: 5, dal: 0 })).toBeNull();
      expect(findNegativeQuantities({ rice: -1, dal: 5 })).toEqual({ rice: -1 });
      expect(findNegativeQuantities({ rice: -1, dal: -2 })).toEqual({ rice: -1, dal: -2 });
    });

    it('treats 0 as non-negative (not a shortage, just empty)', () => {
      expect(findNegativeQuantities({ rice: 0, dal: 0 })).toBeNull();
    });

    it('handles null / undefined input', () => {
      expect(findNegativeQuantities(null)).toBeNull();
      expect(findNegativeQuantities(undefined)).toBeNull();
    });
  });

  describe('pickFefoLot (First Expiry First Out)', () => {
    it('picks the lot with the earliest non-null expiryDate', () => {
      const lots: FefoLot[] = [
        { batchNumber: 'A', qty: 5, expiryDate: '2026-12-01' },
        { batchNumber: 'B', qty: 5, expiryDate: '2026-03-15' },
        { batchNumber: 'C', qty: 5, expiryDate: '2026-09-01' },
      ];
      expect(pickFefoLot(lots)?.batchNumber).toBe('B');
    });

    it('accepts Firestore Timestamp objects via toMillis()', () => {
      const lots: FefoLot[] = [
        { batchNumber: 'A', qty: 5, expiryDate: { toMillis: () => new Date('2027-01-01').getTime() } },
        { batchNumber: 'B', qty: 5, expiryDate: { toMillis: () => new Date('2026-06-01').getTime() } },
      ];
      expect(pickFefoLot(lots)?.batchNumber).toBe('B');
    });

    it('falls back to the largest qty lot when no expiry dates are set', () => {
      const lots: FefoLot[] = [
        { batchNumber: 'A', qty: 5 },
        { batchNumber: 'B', qty: 12 },
        { batchNumber: 'C', qty: 7 },
      ];
      expect(pickFefoLot(lots)?.batchNumber).toBe('B');
    });

    it('ignores lots with null expiryDate when at least one is set', () => {
      // A lot without an expiry date should NOT win FEFO — that
      // would be a random pick from the "no expiry" pool. FEFO
      // means "use the dated one first."
      const lots: FefoLot[] = [
        { batchNumber: 'A', qty: 100, expiryDate: null },
        { batchNumber: 'B', qty: 1, expiryDate: '2026-01-01' },
      ];
      expect(pickFefoLot(lots)?.batchNumber).toBe('B');
    });

    it('returns null for empty / invalid input', () => {
      expect(pickFefoLot([])).toBeNull();
      expect(pickFefoLot(null)).toBeNull();
      expect(pickFefoLot(undefined)).toBeNull();
    });
  });

  describe('chartRowsForTemplate', () => {
    it('produces {commodityId, requiredPerBox, onHand} rows in template order', () => {
      const inv: Record<string, number> = { rice: 50, dal: 10 };
      const tpl: Record<string, number> = { rice: 25, dal: 5 };
      expect(chartRowsForTemplate(inv, tpl)).toEqual([
        { commodityId: 'rice', requiredPerBox: 25, onHand: 50 },
        { commodityId: 'dal', requiredPerBox: 5, onHand: 10 },
      ]);
    });

    it('treats missing inventory as 0', () => {
      expect(chartRowsForTemplate({}, { rice: 25 })).toEqual([
        { commodityId: 'rice', requiredPerBox: 25, onHand: 0 },
      ]);
    });
  });

  describe('boxesByEarliestExpiry', () => {
    it('sorts ascending by per-commodity expiry date', () => {
      const boxes: BoxRecord[] = [
        { id: 'A', contents: { rice: { qty: 5, expiryDate: '2026-09-01' } } },
        { id: 'B', contents: { rice: { qty: 5, expiryDate: '2026-03-01' } } },
        { id: 'C', contents: { rice: { qty: 5, expiryDate: '2026-06-01' } } },
      ];
      expect(boxesByEarliestExpiry(boxes, 'rice').map((b) => b.id)).toEqual(['B', 'C', 'A']);
    });

    it('drops boxes that do not carry the commodity', () => {
      const boxes: BoxRecord[] = [
        { id: 'A', contents: { rice: { qty: 5, expiryDate: '2026-09-01' } } },
        { id: 'B', contents: { dal: { qty: 5, expiryDate: '2026-01-01' } } },
        { id: 'C', contents: {} },
      ];
      expect(boxesByEarliestExpiry(boxes, 'rice').map((b) => b.id)).toEqual(['A']);
    });

    it('drops boxes where the commodity line has no expiry date', () => {
      const boxes: BoxRecord[] = [
        { id: 'A', contents: { rice: { qty: 5, expiryDate: '2026-09-01' } } },
        { id: 'B', contents: { rice: { qty: 5 } } }, // no expiry
      ];
      expect(boxesByEarliestExpiry(boxes, 'rice').map((b) => b.id)).toEqual(['A']);
    });

    it('accepts Firestore Timestamp expiry dates via toMillis()', () => {
      const boxes: BoxRecord[] = [
        { id: 'A', contents: { rice: { qty: 5, expiryDate: { toMillis: () => new Date('2027-01-01').getTime() } } } },
        { id: 'B', contents: { rice: { qty: 5, expiryDate: { toMillis: () => new Date('2026-01-01').getTime() } } } },
      ];
      expect(boxesByEarliestExpiry(boxes, 'rice').map((b) => b.id)).toEqual(['B', 'A']);
    });
  });
});
