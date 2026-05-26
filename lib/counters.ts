const FILE_COUNTER_KEY = "medo-file-download-counter";
const RANGE_ZIP_COUNTER_KEY = "medo-range-zip-download-counter";

function nextCounter(key: string): number {
  if (typeof window === "undefined") return 1;

  const current = Number(window.localStorage.getItem(key) ?? "0");
  const nextValue = Number.isFinite(current) ? current + 1 : 1;
  window.localStorage.setItem(key, String(nextValue));
  return nextValue;
}

export function nextFileDownloadName(): string {
  return `Medo-${nextCounter(FILE_COUNTER_KEY)}.txt`;
}

export function nextRangeZipName(): string {
  return `Medo-Ranges-${nextCounter(RANGE_ZIP_COUNTER_KEY)}.zip`;
}
