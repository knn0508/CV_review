import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UploadSimple, FilePdf, X, ShieldWarning, CheckCircle } from "@phosphor-icons/react";
import { uploadCVs } from "../lib/api";
import { FIELD_META } from "../lib/fields";
import DoubleBezel from "../components/DoubleBezel";
import Eyebrow from "../components/Eyebrow";
import Reveal from "../components/Reveal";
import { IslandButton } from "../components/Button";
import SourceBadge from "../components/SourceBadge";

export default function UploadCVs() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  function addFiles(list) {
    const arr = Array.from(list).filter((f) => /\.(pdf|docx?|txt|md)$/i.test(f.name));
    setFiles((prev) => [...prev, ...arr]);
    setResult(null);
  }

  async function handleUpload() {
    if (!files.length) return;
    setLoading(true);
    const res = await uploadCVs(files);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-40 md:px-8">
      <Reveal>
        <Eyebrow>Step 2 of 3</Eyebrow>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="mt-6 font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-5xl">
          Upload the pile
        </h1>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
          Batch upload PDFs, DOCX, or text. Each file is hashed and cached — re-scoring
          against a different job costs nothing extra for files already parsed.
        </p>
      </Reveal>

      <Reveal delay={200} className="mt-14">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-[2rem] border-2 border-dashed p-16 text-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            dragging ? "scale-[1.01] border-[var(--color-ink)]/40 bg-[var(--color-ink)]/[0.03]" : "border-[var(--color-line)]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <UploadSimple size={32} weight="light" className="mx-auto text-[var(--color-ink-faint)]" />
          <p className="mt-4 font-[var(--font-display)] text-lg font-medium">Drop CVs here, or click to browse</p>
          <p className="mt-1 text-sm text-[var(--color-ink-faint)]">PDF, DOCX, DOC, TXT, MD</p>
        </div>
      </Reveal>

      {files.length > 0 && (
        <Reveal delay={80} className="mt-8">
          <DoubleBezel>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {files.map((f, i) => (
                  <div
                    key={f.name + i}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-ink)]/[0.03] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FilePdf size={18} weight="light" className="shrink-0 text-[var(--color-ink-faint)]" />
                      <span className="truncate text-sm">{f.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="shrink-0 text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
                    >
                      <X size={14} weight="light" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[var(--color-line)] pt-6">
                <span className="text-sm text-[var(--color-ink-faint)]">{files.length} file{files.length !== 1 ? "s" : ""} ready</span>
                <IslandButton onClick={handleUpload} disabled={loading}>
                  {loading ? "Extracting…" : "Extract & score"}
                </IslandButton>
              </div>
            </div>
          </DoubleBezel>
        </Reveal>
      )}

      {result && (
        <Reveal delay={80} className="mt-8">
          <DoubleBezel>
            <div className="p-8">
              <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <CheckCircle size={24} weight="light" className="text-[#3a6e4a]" />
                  <div>
                    <p className="font-[var(--font-display)] text-lg font-medium">
                      {result.accepted} candidate{result.accepted !== 1 ? "s" : ""} extracted, categorized & cached
                    </p>
                    {result.flagged > 0 && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#a03838]">
                        <ShieldWarning size={14} weight="light" />
                        {result.flagged} flagged for hidden-text / prompt-injection review
                      </p>
                    )}
                  </div>
                </div>
                <Link to={`/ranking${result.candidates?.[0]?.field ? `?field=${result.candidates[0].field}` : ""}`}>
                  <IslandButton>View ranking</IslandButton>
                </Link>
              </div>

              {result.candidates?.length > 0 && (
                <div className="mt-6 space-y-2 border-t border-[var(--color-line)] pt-6">
                  {result.candidates.map((c) => {
                    const meta = FIELD_META[c.field] ?? { label: c.field, color: "var(--color-ink-faint)" };
                    return (
                      <div key={c.candidate_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-[var(--color-ink-soft)]">{c.full_name || c.filename}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <SourceBadge source={c.parse_source} label="Parse" />
                          <SourceBadge source={c.classify_source} label="Classify" />
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                            style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DoubleBezel>
        </Reveal>
      )}
    </div>
  );
}
