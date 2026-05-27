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

function getExtension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function isSupported(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(getExtension(fileName));
}

function findBestHeaderKey(keys: string[], kind: "phone" | "range" | "country"): string | null {
  const normalizedKeys = keys.map((key) => ({ original: key, normalized: normalizeHeader(key) }));

  if (kind === "phone") {
    const exactNumber = normalizedKeys.find((item) => item.normalized === "number");
    if (exactNumber) return exactNumber.original;

    const exactPhone = normalizedKeys.find((item) => PHONE_HEADER_EXACT.includes(item.normalized));
    if (exactPhone) return exactPhone.original;

    const includesPhone = normalizedKeys.find((item) =>
      /(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact)/.test(item.normalized)
    );
    if (includesPhone) return includesPhone.original;
  }

  if (kind === "range") {
    const exactRange = normalizedKeys.find((item) => RANGE_HEADER_EXACT.includes(item.normalized));
    if (exactRange) return exactRange.original;

    const includesRange = normalizedKeys.find((item) =>
      /(range|prefix|series|batch)/.test(item.normalized)
    );
    if (includesRange) return includesRange.original;
  }

  if (kind === "country") {
    const exactCountry = normalizedKeys.find((item) => COUNTRY_HEADER_EXACT.includes(item.normalized));
    if (exactCountry) return exactCountry.original;

    const includesCountry = normalizedKeys.find((item) =>
      /(country|nation)/.test(item.normalized)
    );
    if (includesCountry) return includesCountry.original;
  }

  return null;
}

function sanitizeCell(raw: unknown): string {
  return normalizeDigits(String(raw ?? "")).trim();
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

function scoreHeaderRow(row: unknown[]): number {
  const normalizedCells = row.map((cell) => normalizeHeader(String(cell ?? ""))).filter(Boolean);
  if (normalizedCells.length === 0) return 0;

  let score = 0;

  for (const cell of normalizedCells) {
    if (cell === "number") score += 10;
    if (PHONE_HEADER_EXACT.includes(cell)) score += 8;
    if (RANGE_HEADER_EXACT.includes(cell)) score += 4;
    if (COUNTRY_HEADER_EXACT.includes(cell)) score += 4;
    if (/(phone|mobile|telephone|tel|cell|whatsapp|msisdn|contact)/.test(cell)) score += 6;
    if (/(range|prefix|series|batch)/.test(cell)) score += 3;
    if (/(country|nation)/.test(cell)) score += 3;
  }

  return score;
}

function normalizeRowToObjects(rows: unknown[][]): Record<string, unknown>[] {
  if (rows.length === 0) return [];

  let bestHeaderIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const score = scoreHeaderRow(rows[index] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIndex = index;
    }
  }

  if (bestHeaderIndex === -1 || bestScore === 0) {
    return rows
      .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
      .map((row, rowIndex) => {
        const record: Record<string, unknown> = {};
        row.forEach((value, columnIndex) => {
          record[`column_${rowIndex}_${columnIndex}`] = value;
        });
        return record;
      });
  }

  const headerRow = rows[bestHeaderIndex] ?? [];
  const headers = headerRow.map((cell, index) => {
    const value = sanitizeCell(cell);
    return value || `column_${index + 1}`;
  });

  const dataRows = rows.slice(bestHeaderIndex + 1);

  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
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

  const phoneKey = findBestHeaderKey(keys, "phone");
  const rangeKey = findBestHeaderKey(keys, "range");
  const countryKey = findBestHeaderKey(keys, "country");
  const entries: ExtractedEntry[] = [];

  for (const row of rows) {
    const rangeValue = rangeKey ? sanitizeCell(row[rangeKey]) || null : null;
    const countryValue = countryKey ? sanitizeCell(row[countryKey]) || null : null;

    if (phoneKey) {
      const rawPhoneCell = row[phoneKey];
      const candidates = extractPhoneCandidates(rawPhoneCell);
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
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  const normalizedRows = normalizeRowToObjects(matrix);
  return parseStructuredRows(normalizedRows, sheetName);
}

function parseWorkbookFromArrayBuffer(fileName: string, buffer: ArrayBuffer): ParsedResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: false,
    cellText: true,
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
    raw: false,
    cellText: true
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
    const phoneKey = findBestHeaderKey(keys, "phone");
    const rangeKey = findBestHeaderKey(keys, "range");
    const countryKey = findBestHeaderKey(keys, "country");

    if (phoneKey || rangeKey || countryKey) {
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
