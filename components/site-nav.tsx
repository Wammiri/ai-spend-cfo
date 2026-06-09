"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Top navigation, shared across surfaces. Client only for the active-link state.
// The brand pairs the Aperio Finance umbrella (D7) with the product name.

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/memo", label: "CFO Memo" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Aperio
          </span>
          <span className="h-3.5 w-px bg-hairline-strong" aria-hidden />
          <span className="font-serif text-lg leading-none tracking-tight text-ink">
            AI Spend CFO
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-wash font-medium text-accent"
                    : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
