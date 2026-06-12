"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { formatKes } from "@/lib/money";
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  StatusChip,
  EmptyState,
} from "@/components/ui";

/**
 * Payments administration (Epic 5 web): method toggles (5.1), per-org Daraja
 * config (5.3), the reconciliation worklist (5.8), and the guest-request queue
 * (5.7 staff side). Gated by Payments/Bookings permissions; server authoritative.
 */
export default function PaymentsAdminPage() {
  const { can, isLoading } = usePermissions();
  if (isLoading) return <p className="p-6 text-sm text-fg-muted">Loading…</p>;
  if (!can("Payments", "read") && !can("Bookings", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have payments permissions." />
      </div>
    );
  }
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Payments</h1>
      {can("Payments", "read") && (
        <>
          <MethodsSection canManage={can("Payments", "manage")} />
          <MpesaConfigSection canManage={can("Payments", "manage")} />
          <ReconciliationSection canManage={can("Payments", "manage")} />
        </>
      )}
      {can("Bookings", "read") && (
        <RequestsSection canResolve={can("Bookings", "write")} />
      )}
    </div>
  );
}

function MethodsSection({ canManage }: { canManage: boolean }) {
  const methods = useQuery(api.paymentMethods.list);
  const setEnabled = useMutation(api.paymentMethods.setEnabled);
  if (methods === undefined) return null;
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="font-medium">Payment methods</h2>
        <div className="flex flex-wrap gap-4">
          {methods.map((m) => (
            <label key={m.method} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={m.enabled}
                disabled={!canManage}
                onChange={(e) =>
                  setEnabled({ method: m.method, enabled: e.target.checked })
                }
              />
              {m.method.replaceAll("_", " ")}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MpesaConfigSection({ canManage }: { canManage: boolean }) {
  const status = useQuery(api.mpesa.configStatus);
  const saveConfig = useMutation(api.mpesa.saveConfig);
  const [form, setForm] = useState({
    env: "sandbox" as "sandbox" | "production",
    shortcode: "",
    passkey: "",
    consumerKey: "",
    consumerSecret: "",
  });
  const [note, setNote] = useState<string | null>(null);
  if (status === undefined) return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="font-medium">M-Pesa (Daraja) — this property’s own paybill</h2>
        {status.configured ? (
          <p className="text-sm text-fg-muted">
            Configured · {status.env} · shortcode {status.shortcode} · callback
            path <code className="font-mono">/mpesa/callback/{status.callbackToken}</code>
          </p>
        ) : (
          <p className="text-sm text-fg-muted">Not configured yet.</p>
        )}
        {canManage && (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setNote(null);
              try {
                await saveConfig({
                  ...form,
                  transactionType: "CustomerPayBillOnline",
                });
                setNote("Saved. Register the callback URL with Daraja.");
                setForm({ ...form, passkey: "", consumerKey: "", consumerSecret: "" });
              } catch (err) {
                setNote(String((err as Error).message ?? err));
              }
            }}
          >
            <select
              aria-label="Environment"
              className="rounded-lg border border-border bg-bg-input px-2 py-2 text-sm"
              value={form.env}
              onChange={(e) =>
                setForm({ ...form, env: e.target.value as typeof form.env })
              }
            >
              <option value="sandbox">sandbox</option>
              <option value="production">production</option>
            </select>
            <Input
              aria-label="Shortcode"
              placeholder="Business shortcode"
              value={form.shortcode}
              onChange={(e) => setForm({ ...form, shortcode: e.target.value })}
              required
            />
            <Input
              aria-label="Passkey"
              type="password"
              placeholder="Lipa Na M-Pesa passkey"
              value={form.passkey}
              onChange={(e) => setForm({ ...form, passkey: e.target.value })}
              required
            />
            <Input
              aria-label="Consumer key"
              type="password"
              placeholder="Consumer key"
              value={form.consumerKey}
              onChange={(e) => setForm({ ...form, consumerKey: e.target.value })}
              required
            />
            <Input
              aria-label="Consumer secret"
              type="password"
              placeholder="Consumer secret"
              value={form.consumerSecret}
              onChange={(e) => setForm({ ...form, consumerSecret: e.target.value })}
              required
            />
            <Button type="submit">Save credentials</Button>
          </form>
        )}
        {note && <p className="text-sm text-fg-muted">{note}</p>}
      </CardContent>
    </Card>
  );
}

function ReconciliationSection({ canManage }: { canManage: boolean }) {
  const rows = useQuery(api.payments.reconciliationList);
  const resolve = useMutation(api.payments.resolveReconciliation);
  if (rows === undefined) return null;
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="font-medium">Reconciliation</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing waiting — all reconciled.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Booking</TH>
                <TH>Provider</TH>
                <TH>Amount</TH>
                <TH>Receipt</TH>
                <TH>Flags</TH>
                {canManage && <TH>Action</TH>}
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.paymentId}>
                  <TD>{r.bookingReference ?? "—"}</TD>
                  <TD>{r.provider.replaceAll("_", " ")}</TD>
                  <TD>{formatKes(r.amountCents)}</TD>
                  <TD className="font-mono text-xs">{r.receiptNumber ?? "—"}</TD>
                  <TD>
                    {r.amountMismatch ? (
                      <StatusChip status="warning">amount mismatch</StatusChip>
                    ) : (
                      <span className="text-xs text-fg-muted">unmatched</span>
                    )}
                  </TD>
                  {canManage && (
                    <TD>
                      <Button
                        variant="ghost"
                        onClick={() => resolve({ paymentId: r.paymentId })}
                      >
                        Mark reconciled
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RequestsSection({ canResolve }: { canResolve: boolean }) {
  const requests = useQuery(api.guestRequests.listForOrg);
  const resolve = useMutation(api.guestRequests.resolve);
  if (requests === undefined) return null;
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="font-medium">Guest requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-fg-muted">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.requestId} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-mono text-xs text-fg-muted">
                    {r.bookingReference}
                  </span>{" "}
                  {r.message}
                </span>
                {r.status === "open" ? (
                  canResolve ? (
                    <Button variant="ghost" onClick={() => resolve({ requestId: r.requestId })}>
                      Resolve
                    </Button>
                  ) : (
                    <StatusChip status="warning">open</StatusChip>
                  )
                ) : (
                  <StatusChip status="success">resolved</StatusChip>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
