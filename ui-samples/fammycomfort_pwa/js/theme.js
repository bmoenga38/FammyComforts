/* ============================================================
   Fammy Comforts — Theme Engine
   html.dark toggle + localStorage persistence + smooth transitions
   (pattern mirrors HiddenGemApp; dark is the default per DESIGN.md)
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'sc_theme';
  const read = () => {
    try {
      return localStorage.getItem(KEY) || 'dark';
    } catch {
      return 'dark';
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };

  const Theme = {
    current: read(),
    apply() {
      const dark = this.current === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      const meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.setAttribute('content', dark ? '#0b1326' : '#f7f5f1');
      document.querySelectorAll('[data-theme-icon]').forEach((el) => {
        el.textContent = dark ? 'light_mode' : 'dark_mode';
      });
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: this.current } }));
    },
    toggle() {
      this.current = this.current === 'dark' ? 'light' : 'dark';
      write(this.current);
      this.apply();
    }
  };

  // Apply immediately to avoid a flash before the shell wires up.
  document.documentElement.classList.toggle('dark', Theme.current === 'dark');
  window.SC_Theme = Theme;
})();
