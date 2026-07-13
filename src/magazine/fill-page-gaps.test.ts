import { describe, it, expect } from 'vitest';
import { planGapFill } from './fill-page-gaps';

// The hybrid gap plan: a trailing photo first grows proportionally (no crop)
// up to the full text measure, then gains extra height with a capped side-crop,
// and any remainder becomes a push toward the page bottom. Elements that must
// not be resized (ads, full-width infographics) only get the push.

describe('planGapFill', () => {
  it('push-only elements absorb the whole gap as margin', () => {
    const plan = planGapFill({ kind: 'push-only', gap: 120, width: 800, height: 200, measureWidth: 800 });
    expect(plan).toEqual({ scale: 1, extraHeight: 0, pushDown: 120 });
  });

  it('grows a photo proportionally when the gap fits inside the scale headroom', () => {
    // Width can double (400→800) but the gap only allows height 300→450 (×1.5).
    const plan = planGapFill({ kind: 'photo', gap: 150, width: 400, height: 300, measureWidth: 800 });
    expect(plan.scale).toBeCloseTo(1.5);
    expect(plan.extraHeight).toBeCloseTo(0);
    expect(plan.pushDown).toBeCloseTo(0);
  });

  it('crop-grows up to a quarter of the box when the photo is already at full measure', () => {
    // No width headroom; extra height is capped at scaledHeight/3 (≤25% crop).
    const plan = planGapFill({ kind: 'photo', gap: 150, width: 800, height: 300, measureWidth: 800 });
    expect(plan.scale).toBe(1);
    expect(plan.extraHeight).toBeCloseTo(100); // 300/3
    expect(plan.pushDown).toBeCloseTo(50);     // remainder
  });

  it('combines proportional growth, crop and push for a large gap', () => {
    // Scale caps at measure (600→800, ×4/3 → height 400, consumes 100 of the gap);
    // the remaining 100 fits under the crop cap (400/3), so nothing is pushed.
    const plan = planGapFill({ kind: 'photo', gap: 200, width: 600, height: 300, measureWidth: 800 });
    expect(plan.scale).toBeCloseTo(4 / 3);
    expect(plan.extraHeight).toBeCloseTo(100);
    expect(plan.pushDown).toBeCloseTo(0);
  });

  it('never shrinks a photo wider than the measure', () => {
    const plan = planGapFill({ kind: 'photo', gap: 50, width: 900, height: 300, measureWidth: 800 });
    expect(plan.scale).toBe(1);
    expect(plan.extraHeight).toBeCloseTo(50);
    expect(plan.pushDown).toBeCloseTo(0);
  });
});
