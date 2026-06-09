// Placeholder landing page. Batch B0 stands up a deployable, toolchain-proven
// shell only. The real landing, dashboard, and hero memo are built in Batch B1
// to the institutional-finance-with-modern-execution brief (DECISIONS.md D20).

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "clamp(1.5rem, 6vw, 6rem)",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
        background: "#f8fafc",
      }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#64748b",
        }}
      >
        Aperio Finance
      </span>
      <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", margin: 0 }}>
        AI Spend CFO
      </h1>
      <p style={{ fontSize: "1.05rem", color: "#334155", maxWidth: "42rem" }}>
        The FP&amp;A layer for AI spend. Budget variance, spend forecasts, waste
        detection, and a CFO-ready control memo.
      </p>
      <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
        Scaffold in progress (Batch B0).
      </p>
    </main>
  );
}
