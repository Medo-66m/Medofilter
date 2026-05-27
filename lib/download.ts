import JSZip from "jszip";
import { nextFileDownloadName, nextRangeZipName } from "@/lib/counters";
import { formatOutputLine, safeFilePart } from "@/lib/phone";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadNumbersTxt(lines: string[], addPlus: boolean) {
  const fileName = nextFileDownloadName();
  const content = lines.map((line) => formatOutputLine(line, addPlus)).join("\n");
  triggerDownload(new Blob([content], { type: "text/plain;charset=utf-8" }), fileName);
}

export async function downloadRangesZip(
  groupedByRange: Record<string, string[]>,
  addPlus: boolean
) {
  const entries = Object.entries(groupedByRange);
  if (entries.length === 0) {
    throw new Error("لا توجد ranges قابلة للتنزيل.");
  }

  const zip = new JSZip();

  for (const [range, lines] of entries) {
    const safeRange = safeFilePart(range);
    const content = lines.map((line) => formatOutputLine(line, addPlus)).join("\n");
    zip.file(`${safeRange}.txt`, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, nextRangeZipName());
}
