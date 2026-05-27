export type RangeSummaryItem = {
  range: string;
  count: number;
};

export type ExtractedEntry = {
  value: string;
  outputLine: string;
  range: string | null;
  country: string | null;
  sourceSheet: string | null;
  sourceColumn: string | null;
};

export type ParsedResult = {
  fileName: string;
  originalCount: number;
  cleanedCount: number;
  rangesCount: number;
  countriesCount: number;
  rangeSummary: RangeSummaryItem[];
  numbers: string[];
  outputLines: string[];
  groupedByRange: Record<string, string[]>;
  countries: string[];
  sheets: string[];
  outputMode: "numbers" | "pairs";
};

export type StatusTone = "idle" | "info" | "success" | "error";
