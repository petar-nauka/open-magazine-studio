// Fills the empty band at the bottom of paginated pages. CSS multicol balances
// the text above a column-spanning element (mandatory per spec), so a trailing
// wide/full image or ad banner sits glued under the shortened columns and the
// rest of the page stays blank. Browsers have no "float to page bottom", so we
// absorb the measured leftover space ourselves after Paged.js finishes:
//   photo ('wide' images)  → grow proportionally up to the text measure, then
//                            add height with a capped side-crop (object-fit),
//                            then push flush to the page bottom;
//   push-only ('full' images — often infographics that must not be cropped —
//              and spanning ad banners) → keep size, push to the page bottom.
// Only measured-empty space is consumed, so pagination cannot be disturbed.

export type GapKind = 'photo' | 'push-only';

export interface GapPlan {
  scale: number;       // proportional upscale factor (1 = none)
  extraHeight: number; // px added beyond the scaled height (cover-crops the sides)
  pushDown: number;    // px of extra top margin absorbing the remainder
}

// Pure math for how one trailing element absorbs a gap of `gap` px.
// Crop cap: extraHeight ≤ scaledHeight/3 keeps the side-crop under 25% of the box.
export function planGapFill(
  { kind, gap, width, height, measureWidth }:
  { kind: GapKind; gap: number; width: number; height: number; measureWidth: number },
): GapPlan {
  if (kind === 'push-only') return { scale: 1, extraHeight: 0, pushDown: gap };
  const scale = Math.max(1, Math.min(measureWidth / width, (height + gap) / height));
  const scaledHeight = height * scale;
  const remaining = gap - (scaledHeight - height);
  const extraHeight = Math.min(remaining, scaledHeight / 3);
  return { scale, extraHeight, pushDown: remaining - extraHeight };
}

const MM = 96 / 25.4;          // CSS px per mm (Paged.js lays out at 96dpi)
const MIN_GAP = 3 * MM;        // leave bands smaller than ~3mm alone
const SAFETY = 2;              // px slack against sub-pixel rounding overflow

// Trailing elements that may sit between the image and the page bottom without
// blocking the fill: full-width captions, deliberate spacers, empty leftovers.
function isCaptionish(el: HTMLElement): boolean {
  return el.matches('p.text-full, p.spacer') || el.getBoundingClientRect().height === 0;
}

function applyToPage(content: HTMLElement): void {
  // A page holds at most one article-body fragment (openers/plates force page breaks).
  const flow = content.querySelector<HTMLElement>('.article-body');
  if (!flow) return;
  // Spanning elements only: in-column content can't move without re-balancing
  // the columns (which could push text off the page). All blocks are direct
  // children of the flow, so document order == child order.
  const children = Array.from(flow.children) as HTMLElement[];
  let idx = -1;
  for (let i = children.length - 1; i >= 0; i--) {
    if (children[i].matches('img.wide, img.full, .ad-banner-wrap.ad-full')) { idx = i; break; }
  }
  if (idx < 0) return;
  const el = children[idx];

  // rects are affected by any preview zoom/transform; offset* are layout px.
  const contentRect = content.getBoundingClientRect();
  const zoom = content.offsetHeight ? contentRect.height / content.offsetHeight : 1;

  let lastBottom = el.getBoundingClientRect().bottom;
  for (const sib of children.slice(idx + 1)) {
    if (!isCaptionish(sib)) return; // real content follows — the element doesn't end the page
    lastBottom = Math.max(lastBottom, sib.getBoundingClientRect().bottom);
  }

  const gap = (contentRect.bottom - lastBottom) / zoom - SAFETY;
  if (gap < MIN_GAP) return;

  const rect = el.getBoundingClientRect();
  const width = rect.width / zoom;
  const height = rect.height / zoom;
  const kind: GapKind = el.matches('img.wide') ? 'photo' : 'push-only';
  const plan = planGapFill({ kind, gap, width, height, measureWidth: flow.clientWidth });

  if (plan.scale > 1 || plan.extraHeight > 0) {
    el.style.width = `${width * plan.scale}px`;
    el.style.height = `${height * plan.scale + plan.extraHeight}px`;
    el.style.maxHeight = 'none'; // escape the size-class height cap
    el.style.objectFit = 'cover';
  }
  if (plan.pushDown > 0) {
    const marginTop = parseFloat(getComputedStyle(el).marginTop) || 0;
    el.style.marginTop = `${marginTop + plan.pushDown}px`;
  }
}

// Walk every laid-out page and let a trailing spanning image/ad absorb the
// empty band above the footer. Must run after previewer.preview() and before
// data-paged-ready, so both the print button and the PDF export see the result.
export function fillPageGaps(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.pagedjs_page_content').forEach(applyToPage);
}
