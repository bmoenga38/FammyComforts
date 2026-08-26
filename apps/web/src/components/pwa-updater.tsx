"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * PWA update prompt. The service worker (src/app/sw.ts) is skipWaiting +
 * clientsClaim, so a new deploy activates immediately — but the CURRENTLY loaded
 * tab keeps its old JS/CSS until it reloads. That's the "stale cache" trap
 * (e.g. an old page bundle throwing after a fix shipped). This detects a newly
 * installed worker while the page is still controlled by the old one and offers
 * a one-tap reload, so users always pick up fresh deploys. Also polls for
 * updates every 30 min and on tab focus.
 */
export function PwaUpdater() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    const watchInstalling = (r: ServiceWorkerRegistration) => {
      const nw = r.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        // A new worker reached "installed" while an old one still controls the
        // page → an update is ready to take over on reload.
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    };

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) return;
      reg = r;
      // Update already downloaded and waiting when we mounted.
      if (r.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      r.addEventListener("updatefound", () => watchInstalling(r));
      r.update().catch(() => {});
    });

    const check = () => reg?.update().catch(() => {});
    const id = window.setInterval(check, 30 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!updateReady || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] flex justify-center p-3 sm:p-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-card border border-[var(--hairline)] bg-bg-card px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-body-md text-text">
          A new version of Fammy Comforts is ready.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary shrink-0 px-3.5 py-2 text-sm"
        >
          Reload
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="icon-btn size-8 shrink-0"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
