import { PoweredBy } from "@/components/ui/powered-by";

/**
 * Shared shell for the public booking pages (catalog, room detail, lookup,
 * invoice). Adds the consistent ByteBazaar footer below every booking page.
 */
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-4 py-5 text-center">
        <PoweredBy />
      </footer>
    </div>
  );
}
