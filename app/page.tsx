// Placeholder landing page, now on Tailwind (B0.5, D23/D25). B0.5 only proves the
// stack: a Tailwind-styled element renders. The real landing, dashboard, and hero
// memo are built in B1 with the frontend-design skill to the
// institutional-finance-with-modern-execution brief (DECISIONS.md D20).

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-3 bg-paper px-6 py-16 sm:px-12 lg:px-24">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        Aperio Finance
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
        AI Spend CFO
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-slate-600">
        The FP&amp;A layer for AI spend. Budget variance, spend forecasts, waste
        detection, and a CFO-ready control memo.
      </p>
      <p className="text-sm text-accent">Scaffold in progress (Batch B0.5).</p>
    </main>
  );
}
