import { CalendarPlus, Search, Check } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Button,
  Input,
  Card,
  CardContent,
  StatusChip,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  type Status,
} from "@/components/ui";

const statuses: Status[] = ["success", "info", "warning", "danger", "premium"];

const bookings = [
  { ref: "BK-0005", guest: "Kemet Tech", room: "ENZI Heights", status: "info" as Status, label: "Checked in" },
  { ref: "BK-0004", guest: "A. Mwangi", room: "Room 103", status: "warning" as Status, label: "Confirmed" },
  { ref: "BK-0003", guest: "Walk-in", room: "Studio 6A", status: "success" as Status, label: "Checked out" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-text-dim">Component library check</p>
          <h1 className="text-3xl font-bold">UI Primitives</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Book a room
          </Button>
          <Button variant="ghost">Cancel</Button>
          <Button size="sm">Small</Button>
          <Button variant="ghost" size="sm">
            Small ghost
          </Button>
          <Button disabled>Disabled</Button>
        </div>
        <Button fullWidth>
          <Check className="size-4" aria-hidden="true" />
          Full-width primary
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Input</h2>
        <div className="flex max-w-sm flex-col gap-1.5">
          <label htmlFor="demo-search" className="text-sm font-medium text-text-muted">
            Search bookings
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-dim"
              aria-hidden="true"
            />
            <Input id="demo-search" className="pl-9" placeholder="Guest, room, or reference" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Status chips</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusChip key={s} status={s} icon={s === "success" ? <Check /> : undefined}>
              {s}
            </StatusChip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Card &amp; Table</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Ref</TH>
                  <TH>Guest</TH>
                  <TH>Room</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {bookings.map((b) => (
                  <TR key={b.ref}>
                    <TD className="font-mono text-text-muted">{b.ref}</TD>
                    <TD>{b.guest}</TD>
                    <TD>{b.room}</TD>
                    <TD>
                      <StatusChip status={b.status}>{b.label}</StatusChip>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
