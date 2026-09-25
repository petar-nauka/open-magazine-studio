import { describe, it, expect } from 'vitest';
import { planGapFill, spanningTarget } from './fill-page-gaps';

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

// A linked image is wrapped in <a class="img-link">: the <a> is the flow child,
// but the image inside is what gets measured and resized.
describe('spanningTarget', () => {
  const el = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  };

  it('returns a bare spanning image itself', () => {
    const img = el('<img class="wide">');
    expect(spanningTarget(img)).toBe(img);
  });

  it('looks through a link wrapper to the image', () => {
    const a = el('<a class="img-link span" href="https://x"><img class="full"></a>');
    expect(spanningTarget(a)).toBe(a.firstElementChild);
  });

  it('keeps a linked banner advert, whose <a> is the advert itself', () => {
    const ad = el('<a class="ad-banner-wrap ad-full" href="https://x"><img></a>');
    expect(spanningTarget(ad)).toBe(ad);
  });

  it('ignores in-column content, linked or not', () => {
    expect(spanningTarget(el('<img class="inline size-md">'))).toBeNull();
    expect(spanningTarget(el('<a class="img-link" href="https://x"><img class="inline size-md"></a>'))).toBeNull();
    expect(spanningTarget(el('<p>text</p>'))).toBeNull();
  });
});
