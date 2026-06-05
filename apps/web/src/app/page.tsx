import { APP_NAME } from "@sommycomfort/shared";
import { ThemeToggle } from "@/components/theme-toggle";

const colorSwatches = [
  { name: "bg", className: "bg-bg" },
  { name: "bg-card", className: "bg-bg-card" },
  { name: "primary", className: "bg-primary" },
  { name: "accent", className: "bg-accent" },
] as const;

const statuses = [
  { name: "success", className: "text-success" },
  { name: "info", className: "text-info" },
  { name: "warning", className: "text-warning" },
  { name: "danger", className: "text-danger" },
  { name: "premium", className: "text-premium" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-text-dim">Design system check</p>
          <h1 className="text-3xl font-bold">{APP_NAME}</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Core colors</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {colorSwatches.map((s) => (
            <div key={s.name} className="rounded-lg border border-border p-3">
              <div className={`h-12 rounded-md border border-border ${s.className}`} />
              <p className="mt-2 font-mono text-xs text-text-muted">{s.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Status colors</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <span
              key={s.name}
              className={`rounded-full border border-border bg-bg-card px-3 py-1 text-sm font-medium ${s.className}`}
            >
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-text">Typography</h2>
        <p className="font-sans text-text">Inter — body &amp; UI text</p>
        <p className="font-display text-text">Space Grotesk — headings</p>
        <p className="font-expressive text-text">Syne — expressive display</p>
        <p className="font-mono text-text">JetBrains Mono — BK-0001 · KES 3,500.00</p>
      </section>
    </main>
  );
}
