import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Spend CFO by Aperio Finance",
  description:
    "The FP&A layer for AI spend: budget variance, spend forecasts, waste detection, and a CFO-ready control memo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
