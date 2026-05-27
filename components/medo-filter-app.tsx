"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  LoaderCircle,
  MoonStar,
  Sparkles,
  UploadCloud,
  XCircle
} from "lucide-react";
import { downloadNumbersTxt, downloadRangesZip } from "@/lib/download";
import { nextFileDownloadName } from "@/lib/counters";
import { parseFile, validateParsedResult } from "@/lib/file-parser";
import { formatOutputLine, safeFilePart } from "@/lib/phone";
import type { ParsedResult, StatusTone } from "@/lib/types";

type StatusState = {
  tone: StatusTone;
  message: string;
};

const ACCEPTED_FILES = ".xlsx,.csv,.txt,.log,.json,.html,.xml";
const PREVIEW_LIMIT = 20;

function StatusBanner({ status }: { status: StatusState }) {
  const styles =
    status.tone === "error"
      ? "border-red-500/25 bg-red-500/10 text-red-200"
      : status.tone === "success"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
        : status.tone === "info"
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-100"
          : "border-white/10 bg-white/[0.03] text-slate-300";

  const Icon =
    status.tone === "error"
      ? XCircle
      : status.tone === "success"
        ? CheckCircle2
        : status.tone === "info"
          ? LoaderCircle
          : Sparkles;

  return (
    <div className={`animate-pop flex items-start gap-3 rounded-2xl border px-4 py-3 ${styles}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${status.tone === "info" ? "animate-spin" : ""}`} />
      <p className="m-0 text-sm leading-6">{status.message}</p>
    </div>
  );
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass rounded-[1.35rem] p-4 transition duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-soft">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h2 className="m-0 text-lg font-semibold text-white sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
  variant = "secondary"
}: {
  onClick: () => void | Promise<void>;
  disabled: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "cyan";
}) {
  const styles =
    variant === "primary"
      ? "bg-gradient-to-l from-violet-500 to-fuchsia-500 text-white hover:scale-[1.01] active:scale-[0.99]"
      : variant === "cyan"
        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
}

function downloadSingleRangeTxt(range: string, lines: string[], addPlus: boolean) {
  const fileName = `${safeFilePart(range)}-${nextFileDownloadName()}`;
  const content = lines.map((line) => formatOutputLine(line, addPlus)).join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function MedoFilterApp() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [result, setResult] = useState<ParsedResult | null>(null);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: "ارفع الملف وابدأ."
  });
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addPlus, setAddPlus] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const displayLines = useMemo(() => {
    if (!result) return [];
    return result.outputLines.map((line) => formatOutputLine(line, addPlus));
  }, [result, addPlus]);

  const previewLines = useMemo(() => displayLines.slice(0, PREVIEW_LIMIT), [displayLines]);
  const hiddenCount = Math.max(displayLines.length - previewLines.length, 0);

  async function handleSelectedFile(file: File) {
    setLoading(true);
    setCopyDone(false);

    setStatus({
      tone: "info",
      message: `جاري تحليل ${file.name}...`
    });

    try {
      const parsed = validateParsedResult(await parseFile(file));
      setResult(parsed);

      if (parsed.cleanedCount === 0) {
        setStatus({
          tone: "error",
          message: "لم أجد بيانات صالحة داخل الملف."
        });
      } else {
        setStatus({
          tone: "success",
          message:
            parsed.cleanedCount > PREVIEW_LIMIT
              ? `تم العثور على ${parsed.cleanedCount} سطرًا. المعروض أول ${PREVIEW_LIMIT} فقط.`
              : `تم العثور على ${parsed.cleanedCount} سطرًا.`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف.";
      setResult(null);
      setStatus({
        tone: "error",
        message
      });
    } finally {
      setLoading(false);
    }
  }

  async function onFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
    event.target.value = "";
  }

  async function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
  }

  async function onCopy() {
    if (!displayLines.length) return;

    try {
      await navigator.clipboard.writeText(displayLines.join("\n"));
      setCopyDone(true);
      setStatus({
        tone: "success",
        message: `تم نسخ ${displayLines.length} سطرًا.`
      });
      window.setTimeout(() => setCopyDone(false), 1800);
    } catch {
      setStatus({
        tone: "error",
        message: "تعذر النسخ."
      });
    }
  }

  async function onDownloadAll() {
    if (!result?.outputLines.length) return;

    try {
      downloadNumbersTxt(result.outputLines, addPlus);
      setStatus({
        tone: "success",
        message: `تم تنزيل ${result.outputLines.length} سطرًا.`
      });
    } catch {
      setStatus({
        tone: "error",
        message: "فشل إنشاء الملف."
      });
    }
  }

  async function onDownloadRanges() {
    if (!result) return;

    try {
      await downloadRangesZip(result.groupedByRange, addPlus);
      setStatus({
        tone: "success",
        message: "تم تنزيل ملف ranges."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "فشل إنشاء ZIP."
      });
    }
  }

  async function onDownloadSingleRange(range: string) {
    if (!result) return;

    const lines = result.groupedByRange[range] ?? [];
    if (lines.length === 0) {
      setStatus({
        tone: "error",
        message: "هذا الـ range لا يحتوي على بيانات."
      });
      return;
    }

    try {
      downloadSingleRangeTxt(range, lines, addPlus);
      setStatus({
        tone: "success",
        message: `تم تنزيل ${lines.length} سطرًا من ${range}.`
      });
    } catch {
      setStatus({
        tone: "error",
        message: "فشل تنزيل هذا الـ range."
      });
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="glass overflow-hidden rounded-[1.9rem] bg-hero-grid p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] tracking-[0.2em] text-slate-300">
                  <MoonStar className="h-4 w-4 text-violet-300" />
                  MEDO FILTER
                </div>

                <h1 className="m-0 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Clean phone numbers
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  Extract, clean, dedupe, copy, download.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[430px]">
                <StatCard label="Formats" value="7" />
                <StatCard label="Length" value="10–15" />
                <StatCard label="Preview" value="20" />
                <StatCard label="Export" value={result?.outputMode === "pairs" ? "PAIR / ZIP" : "TXT / ZIP"} />
              </div>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="space-y-6">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`glass relative overflow-hidden rounded-[1.75rem] p-5 transition duration-300 ease-smooth sm:p-6 ${
                dragActive ? "border-violet-400/50 shadow-accent" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-cyan-400/5" />

              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-white/6 p-3">
                    <FileSpreadsheet className="h-5 w-5 text-violet-300" />
                  </div>

                  <div>
                    <div className="text-lg font-semibold text-white">Upload file</div>
                    <div className="text-sm text-slate-400">
                      Excel, CSV, TXT, JSON, HTML, XML
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-[1.5rem] border border-dashed px-4 py-8 text-center transition duration-300 ease-smooth sm:px-6 sm:py-10 ${
                    dragActive
                      ? "border-violet-300/70 bg-violet-400/10"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/6">
                    <UploadCloud className="h-8 w-8 text-cyan-300" />
                  </div>

                  <div className="text-lg font-medium text-white">Drop or choose a file</div>
                  <div className="mt-2 text-sm text-slate-400">
                    xlsx / csv / txt / log / json / html / xml
                  </div>

                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="rounded-2xl bg-gradient-to-l from-violet-500 to-cyan-500 px-5 py-3 font-medium text-white transition duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Choose file
                    </button>

                    <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200 transition duration-200 hover:bg-white/8">
                      <span>Add +</span>
                      <button
                        type="button"
                        onClick={() => setAddPlus((prev) => !prev)}
                        className={`relative h-7 w-12 rounded-full transition ${
                          addPlus ? "bg-violet-500" : "bg-white/10"
                        }`}
                        aria-pressed={addPlus}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                            addPlus ? "right-1" : "right-6"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_FILES}
                    className="hidden"
                    onChange={onFileInputChange}
                  />
                </div>

                <div className="mt-4">
                  <StatusBanner status={status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="File" value={result?.fileName ?? "—"} />
              <StatCard label="Before" value={result?.originalCount ?? 0} />
              <StatCard label="After" value={result?.cleanedCount ?? 0} />
              <StatCard label="Ranges" value={result?.rangesCount ?? 0} />
              <StatCard label="Countries" value={result?.countriesCount ?? 0} />
              <StatCard
                label="Visible"
                value={result ? `${previewLines.length}/${displayLines.length}` : "0/0"}
              />
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle title="Actions" subtitle="Copy or export all results." />

              <div className="flex flex-wrap gap-3">
                <ActionButton
                  onClick={onCopy}
                  disabled={!result?.outputLines.length || loading}
                  variant="secondary"
                >
                  <Clipboard className="h-4 w-4" />
                  {copyDone ? "Copied" : "Copy"}
                </ActionButton>

                <ActionButton
                  onClick={onDownloadAll}
                  disabled={!result?.outputLines.length || loading}
                  variant="primary"
                >
                  <Download className="h-4 w-4" />
                  Download all
                </ActionButton>

                <ActionButton
                  onClick={onDownloadRanges}
                  disabled={!result || result.rangesCount === 0 || loading}
                  variant="cyan"
                >
                  <FileArchive className="h-4 w-4" />
                  Download ranges
                </ActionButton>
              </div>
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle
                title="Ranges"
                subtitle="Quick summary"
                right={loading ? <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" /> : null}
              />

              <div className="max-h-[360px] space-y-3 overflow-auto scrollbar-thin pr-1">
                {result?.rangeSummary.length ? (
                  result.rangeSummary.map((item) => (
                    <div
                      key={item.range}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 transition duration-200 hover:bg-white/[0.045]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-200">{item.range}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.count} lines</div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-200">
                            {item.count}
                          </div>

                          <button
                            type="button"
                            onClick={() => void onDownloadSingleRange(item.range)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition duration-200 hover:bg-white/10"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                    No data
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle
                title="Preview"
                subtitle={result?.outputMode === "pairs" ? "First 20 results" : "First 20 numbers"}
                right={
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    <Eye className="h-4 w-4" />
                    Preview
                  </div>
                }
              />

              {result && hiddenCount > 0 ? (
                <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                  Showing {previewLines.length}. The rest is included in copy and download.
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#050812]">
                <div className="border-b border-white/6 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Output
                </div>

                <div className="max-h-[680px] overflow-auto scrollbar-thin">
                  <pre className="m-0 whitespace-pre-wrap break-all p-4 text-sm leading-7 text-slate-200">
                    {previewLines.length ? previewLines.join("\n") : "No output yet."}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="py-6 text-center text-xs tracking-[0.35em] text-slate-500">
          ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴍᴇᴅᴏ
        </footer>
      </div>
    </main>
  );
}
