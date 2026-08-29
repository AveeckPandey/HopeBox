/// <reference path="./jest-globals.d.ts" />
import {
  convert,
  applyUnitConversion,
  listConversions,
  getUnitKind,
} from '../src/services/unitConversion';
import type { Commodity } from '../src/services/commodities';

describe('unitConversion', () => {
  describe('convert', () => {
    it('returns the input when from === to', () => {
      expect(convert(5, 'kg', 'kg')).toBe(5);
    });
    it('converts between mass units', () => {
      expect(convert(1, 'kg', 'g')).toBe(1000);
      expect(convert(500, 'g', 'kg')).toBe(0.5);
    });
    it('converts between volume units', () => {
      expect(convert(1, 'L', 'ml')).toBe(1000);
    });
    it('returns null for cross-kind conversion', () => {
      expect(convert(1, 'kg', 'L')).toBeNull();
    });
    it('returns null for unknown units', () => {
      expect(convert(1, 'barn', 'kg')).toBeNull();
    });
    it('returns null for non-finite input', () => {
      expect(convert('not a number' as unknown as number, 'kg', 'g')).toBeNull();
    });
  });

  describe('applyUnitConversion', () => {
    const commodity: Pick<Commodity, 'unit' | 'unitConversion'> = {
      unit: 'tablet',
      unitConversion: { pack: 24, carton: 480 },
    };

    it('multiplies by the table factor for a known unit', () => {
      expect(applyUnitConversion(2, 'pack', commodity)).toBe(48);
      expect(applyUnitConversion(1, 'carton', commodity)).toBe(480);
    });
    it('returns the input unchanged for the canonical unit', () => {
      // The canonical unit is not in the table by design — the
      // caller is expected to skip the table for the canonical unit.
      expect(applyUnitConversion(3, 'tablet', commodity)).toBe(3);
    });
    it('degrades to identity for an unknown unit', () => {
      expect(applyUnitConversion(3, 'barn', commodity)).toBe(3);
    });
    it('returns 0 for an empty qty', () => {
      expect(applyUnitConversion(0, 'pack', commodity)).toBe(0);
    });
  });

  describe('listConversions', () => {
    it('returns an array of {unit, factor, kind} entries', () => {
      const c: Pick<Commodity, 'unit' | 'unitConversion'> = {
        unit: 'tablet',
        unitConversion: { pack: 24 },
      };
      expect(listConversions(c)).toEqual([
        { unit: 'pack', factor: 24, kind: 'count' },
      ]);
    });
    it('returns an empty array when no table is set', () => {
      // Pass the same shape the function expects (only
      // unitConversion is read); `unit` is ignored.
      expect(listConversions({ unitConversion: undefined })).toEqual([]);
    });
  });

  describe('getUnitKind', () => {
    it('returns the kind for known units', () => {
      expect(getUnitKind('kg')).toBe('mass');
      expect(getUnitKind('L')).toBe('volume');
      expect(getUnitKind('tablet')).toBe('count');
    });
    it('returns "unknown" for anything not in the table', () => {
      expect(getUnitKind('barn')).toBe('unknown');
    });
  });
});
