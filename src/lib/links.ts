// Clean up a link typed by hand for an advert or image. People type
// "night.nauka.bg" rather than "https://night.nauka.bg", and a scheme-less href
// is a relative link that breaks in the PDF, so https:// is added. Blank means
// "no link". Script-running schemes are refused: the preview is a live page and
// clicking such a link there would run it.
export function normalizeHref(input: string): string | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (/^(javascript|data|vbscript):/i.test(value)) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value; // https:, http:, mailto:, tel:
  if (value.startsWith('//')) return 'https:' + value;
  return 'https://' + value;
}
