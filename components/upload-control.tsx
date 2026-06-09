"use client";

import { useRef, useState } from "react";

// The upload surface (D8): a CSV is read and parsed entirely in-browser and
// never stored. This component only reads a file (or fetches a bundled sample)
// to text and hands it up; the page parses, normalizes, and renders. Two sample
// buttons let a visitor see the full pipeline without having any data of their
// own, which keeps the 60-second demo working for everyone.

export interface LoadedFile {
  text: string;
  fileName: string;
  isSample: boolean;
}

export function UploadControl({
  onLoad,
  onClear,
  current,
  busy,
}: {
  onLoad: (file: LoadedFile) => void;
  onClear: () => void;
  current: string | null;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("File is larger than 25 MB. Aggregate it to daily rows first.");
      return;
    }
    try {
      const text = await file.text();
      onLoad({ text, fileName: file.name, isSample: false });
    } catch {
      setError("Could not read that file.");
    }
  }

  async function loadSample(path: string, fileName: string) {
    setError(null);
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error();
      const text = await res.text();
      onLoad({ text, fileName, isSample: true });
    } catch {
      setError("Could not load the sample.");
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-hairline-strong bg-surface p-6 shadow-card">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg tracking-tight text-ink">Import usage data</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Drop an Anthropic Console export or a canonical CSV. It is parsed in
            your browser and never uploaded or stored. No data of your own? Load a
            sample to see the full pipeline.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            Choose CSV
          </button>
          {current ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center rounded-md border border-hairline-strong bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-panel"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <span className="text-xs uppercase tracking-[0.12em] text-faint">Samples</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => loadSample("/sample-anthropic-export.csv", "sample-anthropic-export.csv")}
          className="inline-flex items-center rounded-md border border-hairline-strong bg-paper px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          Anthropic Console export
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => loadSample("/sample-canonical.csv", "sample-canonical.csv")}
          className="inline-flex items-center rounded-md border border-hairline-strong bg-paper px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          Canonical CSV
        </button>
      </div>

      {current ? (
        <p className="mt-3 text-xs text-muted">
          Loaded: <span className="font-medium text-ink">{current}</span>
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-risk">{error}</p> : null}
    </div>
  );
}
