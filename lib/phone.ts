const ARABIC_INDIC_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9"
};

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => ARABIC_INDIC_MAP[char] ?? char);
}

export function normalizeHeader(input: string): string {
  return normalizeDigits(String(input))
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  const normalized = normalizeDigits(String(raw)).trim();
  if (!normalized) return null;

  const digitsOnly = normalized.replace(/\+/g, "").replace(/[^\d]/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 15) return null;

  return digitsOnly;
}

export function extractPhoneCandidates(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];

  const normalized = normalizeDigits(String(raw));
  const matches = normalized.match(/\+?\d[\d\s().-]{8,24}\d/g) ?? [];
  const result: string[] = [];

  for (const match of matches) {
    const cleaned = cleanPhone(match);
    if (cleaned) result.push(cleaned);
  }

  if (result.length > 0) return result;

  const fallback = cleanPhone(normalized);
  return fallback ? [fallback] : [];
}

export function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function withOptionalPlus(value: string, addPlus: boolean): string {
  return addPlus ? `+${value}` : value;
}

export function safeFilePart(input: string): string {
  const normalized = normalizeDigits(input)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);

  return normalized || "Range";
}
