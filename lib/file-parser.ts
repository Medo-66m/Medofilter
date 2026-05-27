import * as XLSX from "xlsx";
import {
  cleanPhone,
  dedupePreserveOrder,
  extractPhoneCandidates,
  normalizeDigits,
  normalizeHeader
} from "@/lib/phone";
import type { ExtractedEntry, ParsedResult, RangeSummaryItem } from "@/lib/types";

const SUPPORTED_EXTENSIONS = new Set([
  "xlsx",
  "csv",
  "txt",
  "log",
  "json",
  "html",
  "xml"
]);

const PHONE_HEADER_EXACT = [
  "number",
  "phone",
  "phone number",
  "mobile",
  "mobile number",
  "telephone",
  "tel",
  "cell",
  "cellphone",
  "whatsapp",
  "msisdn",
  "contact number"
];

const RANGE_HEADER_EXACT = ["range", "prefix", "series", "batch"];
const COUNTRY_HEADER_EXACT = ["country", "country name", "nation"];
const HEADER_SCAN_LIMIT = 100;

function getExtension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function isSupported(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(getExtension(fileName));
}

function sanitizeCell(raw: unknown): string {
  return normalizeDigits(String(raw ?? "")).trim();
}

function isRowEmpty(row: unknown[]): boolean {
  return !row.some((cell) => sanitizeCell(cell) !== "");
}

function normalizeMatrix(rows: unknown[][]): string[][] {
  return rows.map((row) => row.map((cell) => sanitizeCell(cell)));
}

function scoreHeaderRow(row: string[]): number {
  const normalizedCells = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
  if (normalizedCells.length === 0) return 0;

  let score = 0;

  for (const cell of normalizedCells) {
    if (cell === "number") score += 30;
    if (PHONE_HEADER_EXACT.includes(cell)) score += 12;
    if (RANGE_HEADER_EXACT.includes(cell)) score += 10;
    if (COUNTRY_HEADER_EXACT.includes(cell)) score += 10;
    if (/(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact)/.test(cell)) score += 8;
    if (/(range|prefix|series|batch)/.test(cell)) score += 6;
    if (/(country|nation)/.test(cell)) score += 6;
  }

  if (normalizedCells.includes("number")) score += 30;
  if (normalizedCells.includes("range")) score += 10;
  if (normalizedCells.includes("number") && normalizedCells.includes("range")) score += 20;

  return score;
}

function detectHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < limit; i += 1) {
    const score = scoreHeaderRow(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore > 0 ? bestIndex : -1;
}

function findColumnIndex(headers: string[], kind: "phone" | "range" | "country"): number {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  if (kind === "phone") {
    const exactNumberIndex = normalizedHeaders.findIndex((value) => value === "number");
    if (exactNumberIndex !== -1) return exactNumberIndex;

    const exactPhoneIndex = normalizedHeaders.findIndex((value) => PHONE_HEADER_EXACT.includes(value));
    if (exactPhoneIndex !== -1) return exactPhoneIndex;

    return normalizedHeaders.findIndex((value) =>
      /(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact)/.test(value)
    );
  }

  if (kind === "range") {
    const exactRangeIndex = normalizedHeaders.findIndex((value) => RANGE_HEADER_EXACT.includes(value));
    if (exactRangeIndex !== -1) return exactRangeIndex;

    return normalizedHeaders.findIndex((value) => /(range|prefix|series|batch)/.test(value));
  }

  const exactCountryIndex = normalizedHeaders.findIndex((value) => COUNTRY_HEADER_EXACT.includes(value));
  if (exactCountryIndex !== -1) return exactCountryIndex;

  return normalizedHeaders.findIndex((value) => /(country|nation)/.test(value));
}

function splitCountryFromRange(rangeValue: string | null): {
  country: string | null;
  range: string | null;
} {
  if (!rangeValue) {
    return {
      country: null,
      range: null
    };
  }

  const normalized = sanitizeCell(rangeValue).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return {
      country: null,
      range: null
    };
  }

  const match = normalized.match(/^(.+?)\s+(\d{2,})$/);
  if (!match) {
    return {
      country: null,
      range: normalized
    };
  }

  return {
    country: match[1]?.trim() || null,
    range: normalized
  };
}

function pushEntries(
  destination: ExtractedEntry[],
  candidates: string[],
  range: string | null,
  country: string | null,
  sheetName: string | null,
  sourceColumn: string | null
) {
  for (const candidate of candidates) {
    destination.push({
      value: candidate,
      range,
      country,
      sourceSheet: sheetName,
      sourceColumn
    });
  }
}

function extractRowsDirectly(rows: string[][], sheetName: string | null): ExtractedEntry[] {
  if (rows.length === 0) return [];

  const headerIndex = detectHeaderRowIndex(rows);
  const entries: ExtractedEntry[] = [];

  if (headerIndex === -1) {
    for (const row of rows) {
      if (isRowEmpty(row)) continue;

      for (const cell of row) {
        const candidates = extractPhoneCandidates(cell);
        pushEntries(entries, candidates, null, null, sheetName, null);
      }
    }

    return entries;
  }

  const headers = rows[headerIndex] ?? [];
  const dataRows = rows.slice(headerIndex + 1).filter((row) => !isRowEmpty(row));

  const phoneIndex = findColumnIndex(headers, "phone");
  const rangeIndex = findColumnIndex(headers, "range");
  const countryIndex = findColumnIndex(headers, "country");

  for (const row of dataRows) {
    const rawRangeValue = rangeIndex !== -1 ? sanitizeCell(row[rangeIndex]) || null : null;
    const rawCountryValue = countryIndex !== -1 ? sanitizeCell(row[countryIndex]) || null : null;

    const inferredFromRange = !rawCountryValue ? splitCountryFromRange(rawRangeValue) : null;
    const rangeValue = inferredFromRange?.range ?? rawRangeValue;
    const countryValue = rawCountryValue ?? inferredFromRange?.country ?? null;

    if (phoneIndex !== -1) {
      const phoneCell = row[phoneIndex] ?? "";
      const direct = cleanPhone(phoneCell);
      const candidates = direct ? [direct] : extractPhoneCandidates(phoneCell);

      pushEntries(
        entries,
        candidates,
        rangeValue,
        countryValue,
        sheetName,
        headers[phoneIndex] ?? "number"
      );

      continue;
    }

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if (colIndex === rangeIndex || colIndex === countryIndex) continue;

      const headerName = headers[colIndex] ?? `column_${colIndex + 1}`;
      const normalizedHeaderName = normalizeHeader(headerName);

      if (/(country|nation|range|prefix|series|batch)/.test(normalizedHeaderName)) continue;

      const candidates = extractPhoneCandidates(row[colIndex] ?? "");
      pushEntries(entries, candidates, rangeValue, countryValue, sheetName, headerName);
    }
  }

  return entries;
}

export function parseStructuredRows(
  rows: Record<string, unknown>[],
  sheetName: string | null = null
): ExtractedEntry[] {
  if (rows.length === 0) return [];

  const keys = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>())
  );

  const phoneKey = keys.find((key) => normalizeHeader(key) === "number")
    ?? keys.find((key) => PHONE_HEADER_EXACT.includes(normalizeHeader(key)))
    ?? keys.find((key) => /(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact)/.test(normalizeHeader(key)))
    ?? null;

  const rangeKey = keys.find((key) => RANGE_HEADER_EXACT.includes(normalizeHeader(key)))
    ?? keys.find((key) => /(range|prefix|series|batch)/.test(normalizeHeader(key)))
    ?? null;

  const countryKey = keys.find((key) => COUNTRY_HEADER_EXACT.includes(normalizeHeader(key)))
    ?? keys.find((key) => /(country|nation)/.test(normalizeHeader(key)))
    ?? null;

  const entries: ExtractedEntry[] = [];

  for (const row of rows) {
    const rawRangeValue = rangeKey ? sanitizeCell(row[rangeKey]) || null : null;
    const rawCountryValue = countryKey ? sanitizeCell(row[countryKey]) || null : null;

    const inferredFromRange = !rawCountryValue ? splitCountryFromRange(rawRangeValue) : null;
    const rangeValue = inferredFromRange?.range ?? rawRangeValue;
    const countryValue = rawCountryValue ?? inferredFromRange?.country ?? null;

    if (phoneKey) {
      const phoneCell = row[phoneKey];
      const direct = cleanPhone(phoneCell);
      const candidates = direct ? [direct] : extractPhoneCandidates(phoneCell);
      pushEntries(entries, candidates, rangeValue, countryValue, sheetName, phoneKey);
      continue;
    }

    for (const [key, value] of Object.entries(row)) {
      if (key === rangeKey || key === countryKey) continue;

      const normalizedKey = normalizeHeader(key);
      if (/(country|nation|range|prefix|series|batch)/.test(normalizedKey)) continue;

      const candidates = extractPhoneCandidates(value);
      pushEntries(entries, candidates, rangeValue, countryValue, sheetName, key);
    }
  }

  return entries;
}

function buildResult(fileName: string, entries: ExtractedEntry[], sheets: string[]): ParsedResult {
  const originalCount = entries.length;
  const uniqueEntries: ExtractedEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.value)) continue;
    seen.add(entry.value);
    uniqueEntries.push(entry);
  }

  const numbers = uniqueEntries.map((entry) => entry.value);
  const groupedByRangeMap = new Map<string, string[]>();
  const countriesSet = new Set<string>();

  for (const entry of uniqueEntries) {
    if (entry.country) countriesSet.add(entry.country);

    if (entry.range) {
      const existing = groupedByRangeMap.get(entry.range) ?? [];
      existing.push(entry.value);
      groupedByRangeMap.set(entry.range, existing);
    }
  }

  const groupedByRange: Record<string, string[]> = {};
  const rangeSummary: RangeSummaryItem[] = [...groupedByRangeMap.entries()]
    .map(([range, values]) => {
      groupedByRange[range] = values;
      return { range, count: values.length };
    })
    .sort((a, b) => b.count - a.count || a.range.localeCompare(b.range));

  return {
    fileName,
    originalCount,
    cleanedCount: numbers.length,
    rangesCount: rangeSummary.length,
    countriesCount: countriesSet.size,
    rangeSummary,
    numbers,
    groupedByRange,
    countries: [...countriesSet],
    sheets
  };
}

function parseWorkbookSheet(sheet: XLSX.WorkSheet, sheetName: string): ExtractedEntry[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false
  });

  const matrix = normalizeMatrix(rawRows);
  return extractRowsDirectly(matrix, sheetName);
}

function parseWorkbookFromArrayBuffer(fileName: string, buffer: ArrayBuffer): ParsedResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: true,
    cellText: false,
    cellDates: false
  });

  const entries: ExtractedEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    entries.push(...parseWorkbookSheet(sheet, sheetName));
  }

  return buildResult(fileName, entries, workbook.SheetNames);
}

function parseWorkbookFromText(fileName: string, text: string): ParsedResult {
  const workbook = XLSX.read(text, {
    type: "string",
    raw: true,
    cellText: false
  });

  const entries: ExtractedEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    entries.push(...parseWorkbookSheet(sheet, sheetName));
  }

  return buildResult(fileName, entries, workbook.SheetNames);
}

function parseTextLikeFile(fileName: string, text: string): ParsedResult {
  const entries: ExtractedEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const candidates = extractPhoneCandidates(line);
    for (const candidate of candidates) {
      entries.push({
        value: candidate,
        range: null,
        country: null,
        sourceSheet: null,
        sourceColumn: null
      });
    }
  }

  return buildResult(fileName, entries, []);
}

function parseJsonNode(node: unknown, entries: ExtractedEntry[]) {
  if (Array.isArray(node)) {
    if (node.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      entries.push(...parseStructuredRows(node as Record<string, unknown>[]));
      return;
    }

    for (const item of node) parseJsonNode(item, entries);
    return;
  }

  if (node && typeof node === "object") {
    const objectNode = node as Record<string, unknown>;
    const keys = Object.keys(objectNode);
    const hasStructuredKeys = keys.some((key) => {
      const normalizedKey = normalizeHeader(key);
      return (
        normalizedKey === "number"
        || PHONE_HEADER_EXACT.includes(normalizedKey)
        || RANGE_HEADER_EXACT.includes(normalizedKey)
        || COUNTRY_HEADER_EXACT.includes(normalizedKey)
        || /(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact|range|prefix|series|batch|country|nation)/.test(normalizedKey)
      );
    });

    if (hasStructuredKeys) {
      entries.push(...parseStructuredRows([objectNode]));
      return;
    }

    for (const value of Object.values(objectNode)) {
      parseJsonNode(value, entries);
    }

    return;
  }

  const candidates = extractPhoneCandidates(node);
  for (const candidate of candidates) {
    entries.push({
      value: candidate,
      range: null,
      country: null,
      sourceSheet: null,
      sourceColumn: null
    });
  }
}

function parseJsonFile(fileName: string, text: string): ParsedResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("ملف JSON غير صالح.");
  }

  const entries: ExtractedEntry[] = [];
  parseJsonNode(parsed, entries);
  return buildResult(fileName, entries, []);
}

export async function parseFile(file: File): Promise<ParsedResult> {
  if (!isSupported(file.name)) {
    throw new Error("نوع الملف غير مدعوم. الصيغ المتاحة: xlsx, csv, txt, log, json, html, xml");
  }

  const extension = getExtension(file.name);

  if (extension === "xlsx") {
    const buffer = await file.arrayBuffer();
    return parseWorkbookFromArrayBuffer(file.name, buffer);
  }

  const text = await file.text();

  if (extension === "csv") {
    return parseWorkbookFromText(file.name, text);
  }

  if (extension === "json") {
    return parseJsonFile(file.name, text);
  }

  return parseTextLikeFile(file.name, text);
}

export function ensureDisplayNumbers(numbers: string[], addPlus: boolean): string[] {
  return addPlus ? numbers.map((value) => `+${value}`) : dedupePreserveOrder(numbers);
}

export function validateParsedResult(result: ParsedResult): ParsedResult {
  const deduped = dedupePreserveOrder(
    result.numbers
      .map((value) => cleanPhone(value))
      .filter((value): value is string => Boolean(value))
  );

  return {
    ...result,
    numbers: deduped,
    cleanedCount: deduped.length
  };
}
