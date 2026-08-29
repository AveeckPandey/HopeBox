import {
  isFlatLine,
  normalizeLine,
  lineQty,
  totalContents,
  flattenContents,
  validateContents,
} from '../src/services/boxLines';

// `boxLines` is the input gate for box creation / edit. The
// AddBox and EditBox screens call validateContents() and block
// submit on any non-empty error list. If this file silently
// accepts an invalid box (missing required commodity, missing
// expiry on a tracked commodity), a box with bad data lands in
// Firestore and breaks the FEFO + shortage views downstream.
describe('boxLines', () => {
  describe('isFlatLine', () => {
    it('returns true for numbers, false for objects', () => {
      expect(isFlatLine(5)).toBe(true);
      expect(isFlatLine(0)).toBe(true);
      expect(isFlatLine({ qty: 5 })).toBe(false);
      expect(isFlatLine(null)).toBe(false);
    });
  });

  describe('normalizeLine', () => {
    it('returns zeros for null / undefined', () => {
      expect(normalizeLine(null)).toEqual({
        qty: 0, batchNumber: null, expiryDate: null, manufacturingDate: null,
      });
      expect(normalizeLine(undefined)).toEqual({
        qty: 0, batchNumber: null, expiryDate: null, manufacturingDate: null,
      });
    });

    it('wraps a bare number in the line object', () => {
      expect(normalizeLine(5)).toEqual({
        qty: 5, batchNumber: null, expiryDate: null, manufacturingDate: null,
      });
    });

    it('passes through batch/expiry/manufacturing-date when present', () => {
      expect(normalizeLine({
        qty: 10, batchNumber: 'B-1', expiryDate: '2026-12-01', manufacturingDate: '2026-01-01',
      })).toEqual({
        qty: 10, batchNumber: 'B-1', expiryDate: '2026-12-01', manufacturingDate: '2026-01-01',
      });
    });

    it('coerces string qty to Number', () => {
      expect(normalizeLine('5').qty).toBe(5);
    });

    it('treats missing qty as 0', () => {
      expect(normalizeLine({ batchNumber: 'B-1' }).qty).toBe(0);
    });
  });

  describe('lineQty', () => {
    it('returns 0 for null / undefined', () => {
      expect(lineQty(null)).toBe(0);
      expect(lineQty(undefined)).toBe(0);
    });

    it('returns the number for a flat line', () => {
      expect(lineQty(5)).toBe(5);
    });

    it('returns the .qty for an object line', () => {
      expect(lineQty({ qty: 7 })).toBe(7);
    });

    it('returns 0 for an object line with no qty', () => {
      expect(lineQty({ batchNumber: 'B-1' })).toBe(0);
    });
  });

  describe('totalContents', () => {
    it('sums across a mix of flat and object lines', () => {
      expect(totalContents({ rice: 5, dal: { qty: 3 } })).toBe(8);
    });

    it('returns 0 for an empty / null contents map', () => {
      expect(totalContents({})).toBe(0);
      expect(totalContents(null)).toBe(0);
    });
  });

  describe('flattenContents', () => {
    it('strips batch/expiry metadata, keeping only qty', () => {
      const flat = flattenContents({
        rice: { qty: 5, batchNumber: 'B-1', expiryDate: '2026-12-01' },
        dal: 3,
      });
      expect(flat).toEqual({ rice: 5, dal: 3 });
    });

    it('handles null / undefined input', () => {
      expect(flattenContents(null)).toEqual({});
      expect(flattenContents(undefined)).toEqual({});
    });
  });

  describe('validateContents', () => {
    const rice = { id: 'rice', name: 'Rice', required: true, expiryTracking: false, batchTracking: false };
    const amox = { id: 'amoxicillin', name: 'Amoxicillin', required: false, expiryTracking: true, batchTracking: true };
    const commodities = [rice, amox];
    // Tests below use 'amoxicillin' as the key to match the commodity id.

    it('returns no errors for a valid required-only box', () => {
      expect(validateContents({ rice: 5 }, commodities)).toEqual([]);
    });

    it('flags a missing required commodity in strict mode', () => {
      // A flat-number amoxicillin line is also missing its
      // tracked-commodity batch + expiry, so all three errors fire.
      expect(validateContents({ amoxicillin: 10 }, commodities)).toEqual([
        'Amoxicillin: expiry date is required.',
        'Amoxicillin: batch number is required.',
        'Rice: required commodity is missing.',
      ]);
    });

    it('does not flag a missing required commodity in non-strict mode', () => {
      // Non-strict suppresses the "required" gate, but the
      // tracked-commodity batch/expiry checks still fire.
      expect(validateContents({ amoxicillin: 10 }, commodities, { strict: false })).toEqual([
        'Amoxicillin: expiry date is required.',
        'Amoxicillin: batch number is required.',
      ]);
    });

    it('flags missing expiry on a tracked commodity with positive qty', () => {
      // A flat-number line on a tracked commodity is missing
      // both batch AND expiry — both errors fire.
      expect(validateContents({ rice: 5, amoxicillin: 10 }, commodities)).toEqual([
        'Amoxicillin: expiry date is required.',
        'Amoxicillin: batch number is required.',
      ]);
    });

    it('flags missing batch on a tracked commodity with positive qty', () => {
      expect(validateContents({
        rice: 5,
        amoxicillin: { qty: 10, expiryDate: '2026-12-01' },
      }, commodities)).toEqual([
        'Amoxicillin: batch number is required.',
      ]);
    });

    it('passes a fully populated medical line', () => {
      expect(validateContents({
        rice: 5,
        amoxicillin: { qty: 10, batchNumber: 'B-1', expiryDate: '2026-12-01' },
      }, commodities)).toEqual([]);
    });

    it('skips the expiry/batch requirement when the line qty is 0', () => {
      // A 0-qty line shouldn't trigger the tracked-commodity
      // checks — it's an empty line, not a missing data point.
      expect(validateContents({
        rice: 5,
        amoxicillin: { qty: 0 },
      }, commodities)).toEqual([]);
    });

    it('flags an unknown commodity id', () => {
      expect(validateContents({ rice: 5, mystery: 1 }, commodities)).toEqual([
        'Unknown commodity: mystery',
      ]);
    });

    it('flags a negative qty', () => {
      // A negative qty is malformed AND counts as "missing" in
      // strict mode (lineQty(-1) is -1, which is <= 0). Both
      // errors fire — that's the desired behavior, because a
      // negative entry is unambiguously wrong input that the
      // user must fix.
      expect(validateContents({ rice: -1 }, commodities)).toEqual([
        'Rice: quantity must be a non-negative number.',
        'Rice: required commodity is missing.',
      ]);
    });
  });
});
