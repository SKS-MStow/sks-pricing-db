/* Session gate — every page awaits `authReady` before doing anything.
   Mirrors the V1 sks-quotes auth-gate pattern:
     401                → redirect to /login?redirect=<here>
     no `quotes` grant  → redirect to /dashboard
     network failure    → themed "needs a connection" screen (server is the
                          source of truth; no offline editing)
     200 + grant        → resolves { user, name, initials, isAdmin }
   On any redirect the promise never resolves, so page init halts cleanly. */

import { initialsOf } from './ui.js?v=1';

const HALT = new Promise(() => {});

function showUnavailable() {
  const paint = () => {
    document.title = 'Pricing Database unavailable';
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg,#F4F5F9);color:var(--ink,#20242C);font-family:Mulish,system-ui,sans-serif">
        <section style="width:min(440px,100%);padding:28px;border:1px solid var(--line,#DFE2EC);border-radius:16px;background:var(--surface,#fff);box-shadow:0 12px 30px rgba(31,51,92,.08)">
          <h1 style="margin:0 0 10px;font-family:Roboto,system-ui,sans-serif;font-size:22px;color:var(--navy,#1F335C)">Pricing Database needs a connection</h1>
          <p style="margin:0 0 20px;line-height:1.55;color:var(--muted,#5A6172)">The server could not be reached. The server is the source of truth.</p>
          <button type="button" onclick="location.reload()" style="min-height:44px;border:0;border-radius:9px;padding:0 18px;background:var(--accent,#7C77B9);color:#fff;font:600 14px Mulish,system-ui,sans-serif;cursor:pointer">Try again</button>
        </section>
      </main>`;
  };
  if (document.body) paint();
  else window.addEventListener('DOMContentLoaded', paint, { once: true });
}

export const authReady = (async () => {
  let res;
  try {
    res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
  } catch {
    showUnavailable();
    return HALT;
  }
  if (res.status === 401) {
    location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search);
    return HALT;
  }
  if (!res.ok) {
    location.href = '/dashboard';
    return HALT;
  }
  const j = await res.json().catch(() => ({}));
  const user = j.user || j;
  const apps = user.allowed_apps || [];
  /* Pages needing a different app grant set <html data-app-grant="...">
     (e.g. pricing.html — the Pricing Database has its own grant). */
  const grant = document.documentElement.dataset.appGrant || 'pricing';
  if (user.role !== 'admin' && !apps.includes(grant)) {
    location.href = '/dashboard';
    return HALT;
  }
  const name = user.name || user.username || 'User';
  return {
    user,
    name,
    initials: user.initials || initialsOf(name),
    isAdmin: user.role === 'admin',
  };
})();
