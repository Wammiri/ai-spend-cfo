// Honest-labeling banner (DISCOVERY section 9 credibility gate): Northstar is
// synthetic and must be labeled "sample" everywhere it appears. Shown on the
// dashboard and the memo so a viewer is never misled into thinking the numbers
// are real spend. The live Anthropic Console parser shipped in B2 (see Import);
// real own-spend data is still being connected.

import Link from "next/link";

export function SampleBanner({ org = "Northstar AI Labs" }: { org?: string }) {
  return (
    <div className="flex items-center gap-3 border border-caution/30 bg-caution-wash px-4 py-2.5 text-sm text-caution">
      <span className="inline-flex shrink-0 items-center rounded-sm border border-caution/40 bg-caution/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
        Sample
      </span>
      <p className="leading-snug">
        Synthetic demonstration data for{" "}
        <span className="font-medium">{org}</span>. Not real spend. Run the live
        parser on your own export from{" "}
        <Link href="/upload" className="font-medium underline underline-offset-2">Import</Link>; real own-spend data is still being connected.
      </p>
    </div>
  );
}
