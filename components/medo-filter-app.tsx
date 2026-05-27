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
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : status.tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : status.tone === "info"
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
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
    <div className="glass rounded-[1.4rem] p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-accent">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-text">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export default function MedoFilterApp() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [result, setResult] = useState<ParsedResult | null>(null);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: "ارفع الملف، وسأعالج كل الأرقام كاملة وأعرض لك أول 20 رقم فقط."
  });
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addPlus, setAddPlus] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const displayNumbers = useMemo(() => {
    if (!result) return [];
    return result.numbers.map((value) => withOptionalPlus(value, addPlus));
  }, [result, addPlus]);

  const previewNumbers = useMemo(() => {
    return displayNumbers.slice(0, PREVIEW_LIMIT);
  }, [displayNumbers]);

  const hiddenCount = Math.max(displayNumbers.length - previewNumbers.length, 0);

  async function handleSelectedFile(file: File) {
    setLoading(true);
    setCopyDone(false);
    setStatus({
      tone: "info",
      message: `جاري قراءة الملف ${file.name} وتحليل الأرقام...`
    });

    try {
      const parsed = validateParsedResult(await parseFile(file));
      setResult(parsed);

      if (parsed.cleanedCount === 0) {
        setStatus({
          tone: "error",
          message:
            "لم أجد أرقامًا صالحة بطول من 10 إلى 15 رقمًا داخل الملف. تأكد من البيانات أو جرّب ملفًا آخر."
        });
      } else {
        const previewHint =
          parsed.cleanedCount > PREVIEW_LIMIT
            ? `أعرض لك أول ${PREVIEW_LIMIT} رقم فقط داخل الصفحة، لكن النسخ والتحميل يشملان كل الأرقام بالكامل.`
            : "تم التحليل بنجاح.";

        setStatus({
          tone: "success",
          message: `تم التحليل بنجاح. وجدت ${parsed.originalCount} رقمًا قبل إزالة التكرار، والنتيجة النهائية ${parsed.cleanedCount} رقمًا. ${previewHint}`
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء قراءة الملف.";
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
        message: `تم نسخ ${displayNumbers.length} رقمًا كاملًا إلى الحافظة.`
      });
      window.setTimeout(() => setCopyDone(false), 1800);
    } catch {
      setStatus({
        tone: "error",
        message: "تعذر النسخ تلقائيًا من المتصفح. جرّب مرة ثانية أو استخدم التحميل."
      });
    }
  }

  async function onDownloadAll() {
    if (!result?.numbers.length) return;

    try {
      downloadNumbersTxt(result.numbers, addPlus);
      setStatus({
        tone: "success",
        message: `تم تنزيل ملف TXT يحتوي على ${result.numbers.length} رقمًا كاملًا.`
      });
    } catch {
      setStatus({
        tone: "error",
        message: "حدثت مشكلة أثناء إنشاء ملف TXT."
      });
    }
  }

  async function onDownloadRanges() {
    if (!result) return;

    try {
      await downloadRangesZip(result.groupedByRange, addPlus);
      setStatus({
        tone: "success",
        message: "تم إنشاء ملف ZIP للـ ranges وتنزيله."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "تعذر إنشاء ملف ZIP."
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

                <h1 className="m-0 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  فلترة قوية للأرقام
                  <span className="bg-gradient-to-l from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                    {" "}
                    بدون ما تثقل الصفحة
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  ارفع الملف، وسيتم استخراج الأرقام وتنظيفها وحذف التكرار. الموقع يعالج كل
                  الأرقام كاملة، لكنه يعرض أول 20 رقم فقط داخل الصفحة حتى يظل سريعًا ومريحًا.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[460px]">
                <StatCard label="الصيغ" value="7" hint="xlsx, csv, txt..." />
                <StatCard label="المدى المقبول" value="10–15" hint="أرقام فقط" />
                <StatCard label="الناتج" value="TXT / ZIP" hint="نسخ وتنزيل" />
                <StatCard label="المعاينة" value="20" hint="فقط داخل الصفحة" />
              </div>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
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
                    <div className="text-lg font-semibold">ارفع الملف أو اسحبه هنا</div>
                    <div className="text-sm text-slate-400">
                      التحليل يبدأ تلقائيًا، والتحميل والنسخ يشملان كل الأرقام كاملة.
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

                  <div className="text-lg font-medium">اختر ملفك الآن</div>
                  <div className="mt-2 text-sm leading-7 text-slate-400">
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
                      <span>إضافة + قبل كل رقم</span>
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
                hint={result ? "تمت قراءته" : "بانتظار الرفع"}
              />
              <StatCard
                label="قبل حذف التكرار"
                value={result?.originalCount ?? 0}
                hint="بعد التنظيف الأولي"
              />
              <StatCard
                label="بعد التنظيف والحذف"
                value={result?.cleanedCount ?? 0}
                hint="النتيجة النهائية"
              />
              <StatCard
                label="عدد الـ Ranges"
                value={result?.rangesCount ?? 0}
                hint="من البيانات المتاحة"
              />
              <StatCard
                label="عدد الدول"
                value={result?.countriesCount ?? 0}
                hint="إن كانت موجودة"
              />
              <StatCard
                label="المعروض"
                value={result ? `${previewNumbers.length}/${displayNumbers.length}` : "0/0"}
                hint="داخل الصفحة فقط"
              />
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="m-0 text-xl font-semibold">الأوامر السريعة</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    النسخ والتحميل يعملان على كل الأرقام، وليس فقط المعروض.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!result?.numbers.length || loading}
                    onClick={onCopy}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Clipboard className="h-4 w-4" />
                    {copyDone ? "تم النسخ" : "نسخ كل الأرقام"}
                  </button>

                  <button
                    type="button"
                    disabled={!result?.numbers.length || loading}
                    onClick={onDownloadAll}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-medium transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Download className="h-4 w-4" />
                    تحميل TXT واحد
                  </button>

                  <button
                    type="button"
                    disabled={!result || result.rangesCount === 0 || loading}
                    onClick={onDownloadRanges}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FileArchive className="h-4 w-4" />
                    تحميل حسب Range
                  </button>
                </div>
              </div>
            </div>

            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-xl font-semibold">ملخص الـ Ranges</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    كل Range مع عدد الأرقام الخاصة به بعد التنظيف وحذف التكرار.
                  </p>
                </div>
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" /> : null}
              </div>

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
                    لا توجد ranges ظاهرة في الملف الحالي.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="glass rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-xl font-semibold">معاينة أول 20 رقم</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    هذه مجرد معاينة سريعة. الملف النهائي والنسخ يحتويان على كل الأرقام.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  <Eye className="h-4 w-4" />
                  Preview
                </div>
              </div>

              {result && hiddenCount > 0 ? (
                <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                  المعروض الآن أول {previewNumbers.length} رقم فقط، ويوجد {hiddenCount} رقم
                  إضافي محفوظين بالكامل للنسخ والتحميل.
                </div>
              ) : null}

              <div className="max-h-[520px] overflow-auto rounded-[1.25rem] border border-white/8 bg-[#050812] scrollbar-thin">
                <pre className="m-0 whitespace-pre-wrap break-all p-4 text-sm leading-7 text-slate-200">
                  {previewNumbers.length
                    ? previewNumbers.join("\n")
                    : "لا يوجد ناتج بعد. ارفع ملفًا للبدء."}
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
