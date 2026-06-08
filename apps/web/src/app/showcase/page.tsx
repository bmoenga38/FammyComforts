import { BedDouble, CreditCard, TriangleAlert, Brush, Check, Inbox } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShowcaseInteractive } from "./_showcase-interactive";
import {
  Button,
  StatusChip,
  type Status,
  MetricTile,
  TaskCard,
  Kanban,
  KanbanColumn,
  Card,
  CardContent,
  CalendarSlot,
  type SlotState,
  EmptyState,
} from "@/components/ui";

const statuses: Status[] = ["success", "info", "warning", "danger", "premium"];
const slots: SlotState[] = ["available", "booked", "cleaning", "occupied", "checkout"];

export default function ShowcasePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-text-dim">Component library check</p>
          <h1 className="text-3xl font-bold">Composite components</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Buttons &amp; status</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Check className="size-4" aria-hidden="true" />
            Primary
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Small</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusChip key={s} status={s}>
              {s}
            </StatusChip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">MetricTile</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile icon={<BedDouble />} label="Occupancy" value="80%" note="4 of 5 rooms" />
          <MetricTile icon={<CreditCard />} label="Revenue" value="KES 7,006" note="This month" />
          <MetricTile icon={<TriangleAlert />} label="Outstanding" value="KES 46,958" note="Unpaid" />
          <MetricTile icon={<Brush />} label="Housekeeping" value="2" note="Open tasks" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">TaskCard</h2>
        <TaskCard
          status="warning"
          statusLabel="In progress"
          title="Room 103 daily cleaning"
          description="Guest checked out. Verify towels, bed, cups, and bathroom kit."
          checklist={[
            { label: "Bedding changed", done: true },
            { label: "Bathroom cleaned" },
            { label: "Assets verified" },
          ]}
          action={<Button size="sm">Mark complete</Button>}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Kanban</h2>
        <Kanban>
          <KanbanColumn title="Pending" count={1}>
            <Card>
              <CardContent className="p-3">
                <p className="font-mono text-xs text-text-muted">ORD-811D6E</p>
                <p className="text-sm text-text">Room service — ENZI Heights</p>
              </CardContent>
            </Card>
          </KanbanColumn>
          <KanbanColumn title="Preparing" count={1}>
            <Card>
              <CardContent className="p-3">
                <p className="font-mono text-xs text-text-muted">ORD-812A10</p>
                <p className="text-sm text-text">2 sodas, breakfast tray</p>
              </CardContent>
            </Card>
          </KanbanColumn>
          <KanbanColumn title="Ready">
            <EmptyState icon={<Inbox />} title="No ready orders" />
          </KanbanColumn>
        </Kanban>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">CalendarSlot</h2>
        <div className="grid grid-cols-5 gap-2">
          {slots.map((s) => (
            <CalendarSlot key={s} state={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">SegmentedControl &amp; Toast</h2>
        <ShowcaseInteractive />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">EmptyState</h2>
        <EmptyState
          icon={<Inbox />}
          title="No bookings yet"
          description="New reservations will show up here."
          action={<Button size="sm">Create booking</Button>}
        />
      </section>
    </main>
  );
}
