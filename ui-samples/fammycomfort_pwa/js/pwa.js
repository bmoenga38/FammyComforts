/* ============================================================
   Fammy Comforts — PWA plumbing
   Service-worker registration · install prompt · network status · sync
   ============================================================ */
(function () {
  'use strict';

  /* ---- Service worker ---- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* prototype: silent fail when opened via file:// */
      });
    });
  }

  /* ---- Install prompt ---- */
  let deferredPrompt = null;
  const showInstall = (show) => {
    document.querySelectorAll('[data-install-prompt]').forEach((el) => {
      el.classList.toggle('hide', !show);
    });
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstall(false);
    window.SC_toast && window.SC_toast('App installed — welcome aboard', 'success', 'install_mobile');
  });

  window.SC_install = async () => {
    if (!deferredPrompt) {
      window.SC_toast &&
        window.SC_toast('Use your browser menu → "Install app" to add Fammy Comforts', 'info', 'install_mobile');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    showInstall(false);
  };

  /* ---- Network status ---- */
  const paintNet = () => {
    const online = navigator.onLine;
    document.querySelectorAll('[data-net-status]').forEach((el) => {
      el.dataset.netStatus = online ? 'online' : 'offline';
      const dot = el.querySelector('[data-net-dot]');
      const label = el.querySelector('[data-net-label]');
      if (dot) dot.className = 'net-dot ' + (online ? 'is-online' : 'is-offline');
      if (label) label.textContent = online ? 'Online' : 'Offline';
    });
    if (!online) {
      window.SC_toast && window.SC_toast('You are offline — changes will sync when reconnected', 'warn', 'cloud_off');
    }
  };
  window.addEventListener('online', () => {
    paintNet();
    window.SC_toast && window.SC_toast('Back online — syncing…', 'success', 'cloud_done');
  });
  window.addEventListener('offline', paintNet);
  document.addEventListener('DOMContentLoaded', paintNet);
})();
