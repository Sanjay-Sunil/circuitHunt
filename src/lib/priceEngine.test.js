import { describe, it, expect } from 'vitest';
import { getActiveWindowIndex, getPrice, WINDOW_DURATION_MS } from './priceEngine';

describe('priceEngine', () => {
  describe('getActiveWindowIndex', () => {
    it('returns null if gameStartTimestamp is null', () => {
      expect(getActiveWindowIndex(null, Date.now())).toBeNull();
    });

    it('returns null if now < gameStartTimestamp', () => {
      const start = 100000;
      const now = 90000;
      expect(getActiveWindowIndex(start, now)).toBeNull();
    });

    it('returns 0 at t=0', () => {
      const start = 100000;
      const now = 100000;
      expect(getActiveWindowIndex(start, now)).toBe(0);
    });

    it('returns 0 at t=4m59s', () => {
      const start = 100000;
      const now = start + (4 * 60 * 1000) + (59 * 1000); // + 4m59s
      expect(getActiveWindowIndex(start, now)).toBe(0);
    });

    it('returns 1 at t=5m', () => {
      const start = 100000;
      const now = start + (5 * 60 * 1000); // + 5m
      expect(getActiveWindowIndex(start, now)).toBe(1);
    });

    it('returns 3 at t=19m59s', () => {
      const start = 100000;
      const now = start + (19 * 60 * 1000) + (59 * 1000); // + 19m59s
      expect(getActiveWindowIndex(start, now)).toBe(3);
    });

    it('returns 0 at t=20m (wraps)', () => {
      const start = 100000;
      const now = start + (20 * 60 * 1000); // + 20m
      expect(getActiveWindowIndex(start, now)).toBe(0);
    });
  });

  describe('getPrice', () => {
    const mockOutpost = {
      prices: {
        itemA: [10, 20, 30, 40]
      }
    };

    it('returns correct price for given window', () => {
      expect(getPrice(mockOutpost, 'itemA', 0)).toBe(10);
      expect(getPrice(mockOutpost, 'itemA', 2)).toBe(30);
    });

    it('returns undefined if component is not carried by outpost', () => {
      expect(getPrice(mockOutpost, 'itemB', 0)).toBeUndefined();
    });
  });
});
