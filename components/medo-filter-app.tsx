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
import { parseFile, validateParsedResult } from "@/lib/file-parser";
import { withOptionalPlus } from "@/lib/phone";
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
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="glass rounded-[1.35rem] p-4 transition duration-200 hover:-translate-y-0.5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
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

  const displayNumbers = useMemo(() => {
    if (!result) return [];
    return result.numbers.map((value) => withOptionalPlus(value, addPlus));
  }, [result, addPlus]);

  const previewNumbers = useMemo(() => displayNumbers.slice(0, PREVIEW_LIMIT), [displayNumbers]);
  const hiddenCount = Math.max(displayNumbers.length - previewNumbers.length, 0);

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
          message: "لم أجد أرقامًا صالحة داخل الملف."
        });
      } else {
        setStatus({
          tone: "success",
          message:
            parsed.cleanedCount > PREVIEW_LIMIT
              ? `تم العثور على ${parsed.cleanedCount} رقمًا. المعروض أول ${PREVIEW_LIMIT} فقط.`
              : `تم العثور على ${parsed.cleanedCount} رقمًا.`
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
    if (!displayNumbers.length) return;

    try {
      await navigator.clipboard.writeText(displayNumbers.join("\n"));
      setCopyDone(true);
      setStatus({
        tone: "success",
        message: `تم نسخ ${displayNumbers.length} رقمًا.`
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
    if (!result?.numbers.length) return;

    try {
      downloadNumbersTxt(result.numbers, addPlus);
      setStatus({
        tone: "success",
        message: `تم تنزيل ${result.numbers.length} رقمًا.`
      });
    } catch {
      setStatus({
        tone: "error",
        message: "فشل إنشاء ملف TXT."
      });
    }
  }

  async function onDownloadRanges() {
    if (!result) return;

    try {
      await downloadRangesZip(result.groupedByRange, addPlus);
      setStatus({
        tone: "success",
        message: "تم تنزيل ZIP."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "فشل إنشاء ZIP."
      });
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="glass rounded-[1.75rem] bg-hero-grid p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  <MoonStar className="h-4 w-4 text-violet-300" />
                  Medo Filter
                </div>

                <h1 className="m-0 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Filter numbers
                </h1>

                <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
                  رفع، تنظيف، حذف التكرار، تنزيل.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[430px]">
                <StatCard label="الصيغ" value="7" />
                <StatCard label="الحد" value="10–15" />
                <StatCard label="المعاينة" value="20" />
                <StatCard label="الناتج" value="TXT / ZIP" />
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
              className={`glass relative overflow-hidden rounded-[1.75rem] p-5 transition duration-200 sm:p-6 ${
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
                    <div className="text-lg font-semibold text-white">ارفع الملف</div>
                    <div className="text-sm text-slate-400">
                      Excel, CSV, TXT, JSON, HTML, XML
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-[1.5rem] border border-dashed px-4 py-8 text-center transition duration-200 sm:px-6 sm:py-10 ${
                    dragActive
                      ? "border-violet-300/70 bg-violet-400/10"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/6">
                    <UploadCloud className="h-8 w-8 text-cyan-300" />
                  </div>

                  <div className="text-lg font-medium text-white">اسحب الملف هنا أو اختره</div>
                  <div className="mt-2 text-sm text-slate-400">
                    xlsx / csv / txt / log / json / html / xml
                  </div>

                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="rounded-2xl bg-gradient-to-l from-violet-500 to-cyan-500 px-5 py-3 font-medium text-white transition hover:scale-[1.01] active:scale-[0.99]"
                    >
                      اختيار ملف
                    </button>

                    <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/8">
                      <span>إضافة +</span>
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
              <StatCard
                label="الملف"
                value={result?.fileName ?? "—"}
                hint={result ? "تمت القراءة" : "بانتظار الملف"}
              />
              <StatCard label="قبل الحذف" value={result?.originalCount ?? 0} />
              <StatCard label="بعد الحذف" value={result?.cleanedCount ?? 0} />
              <StatCard label="الـ Ranges" value={result?.rangesCount ?? 0} />
              <StatCard label="الدول" value={result?.countriesCount ?? 0} />
              <StatCard
                label="المعروض"
                value={result ? `${previewNumbers.length}/${displayNumbers.length}` : "0/0"}
              />
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle title="الأدوات" subtitle="النسخ والتحميل يشملان كل الأرقام." />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!result?.numbers.length || loading}
                  onClick={onCopy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Clipboard className="h-4 w-4" />
                  {copyDone ? "تم النسخ" : "نسخ"}
                </button>

                <button
                  type="button"
                  disabled={!result?.numbers.length || loading}
                  onClick={onDownloadAll}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-medium text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download className="h-4 w-4" />
                  TXT
                </button>

                <button
                  type="button"
                  disabled={!result || result.rangesCount === 0 || loading}
                  onClick={onDownloadRanges}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <FileArchive className="h-4 w-4" />
                  ZIP
                </button>
              </div>
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle
                title="الـ Ranges"
                subtitle="ملخص سريع"
                right={loading ? <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" /> : null}
              />

              <div className="max-h-[290px] space-y-3 overflow-auto scrollbar-thin pr-1">
                {result?.rangeSummary.length ? (
                  result.rangeSummary.map((item) => (
                    <div
                      key={item.range}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="truncate text-sm text-slate-200">{item.range}</div>
                      <div className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-200">
                        {item.count}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                    لا توجد بيانات.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <SectionTitle
                title="المعاينة"
                subtitle="أول 20 رقم فقط"
                right={
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    <Eye className="h-4 w-4" />
                    Preview
                  </div>
                }
              />

              {result && hiddenCount > 0 ? (
                <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                  المعروض {previewNumbers.length} فقط، والباقي موجود في النسخ والتحميل.
                </div>
              ) : null}

              <div className="max-h-[640px] overflow-auto rounded-[1.25rem] border border-white/8 bg-[#050812] scrollbar-thin">
                <pre className="m-0 whitespace-pre-wrap break-all p-4 text-sm leading-7 text-slate-200">
                  {previewNumbers.length
                    ? previewNumbers.join("\n")
                    : "لا يوجد ناتج بعد."}
                </pre>
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
