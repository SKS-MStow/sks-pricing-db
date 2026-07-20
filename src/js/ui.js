/* Tiny page runtime: state -> html string, re-rendered on every setState.
   Mirrors the design prototype's DCLogic model so markup ports 1:1.

   Event wiring is delegated via data attributes on rendered elements:
     data-click="actionName"  data-input="..."  data-change="..."
     data-ctx="..." (contextmenu)  data-keydown="..."  data-blur="..."
     data-dragstart / data-dragover / data-drop / data-dragend
   Handlers receive (event, dataset, element); extra args ride on data-* attrs.

   Focus, text selection and scroll positions survive re-renders:
     inputs carry data-focus="stable-key"; scroll containers data-scroll="key".
   <select> initial value is set via data-value (attributes can't express it). */

export function fmt(n) { return '$' + Math.round(n || 0).toLocaleString('en-AU'); }
export function fmtSigned(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
export function initialsOf(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

const EVENTS = [
  ['click', 'click'], ['input', 'input'], ['change', 'change'],
  ['contextmenu', 'ctx'], ['keydown', 'keydown'], ['blur', 'blur'],
  ['dragstart', 'dragstart'], ['dragover', 'dragover'], ['drop', 'drop'], ['dragend', 'dragend'],
];

export function createApp({ root, state, actions, render, afterRender }) {
  const app = {
    state,
    setState(patch) {
      const p = typeof patch === 'function' ? patch(app.state) : patch;
      if (p) Object.assign(app.state, p);
      scheduleRender();
    },
    render: doRender,
  };

  let queued = false;
  function scheduleRender() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; doRender(); });
  }

  function doRender() {
    // capture focus + selection
    const active = document.activeElement;
    let focusKey = null, selStart = null, selEnd = null;
    if (active && root.contains(active) && active.dataset && active.dataset.focus) {
      focusKey = active.dataset.focus;
      try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch { /* not a text control */ }
    }
    // capture scroll positions
    const scrolls = {};
    root.querySelectorAll('[data-scroll]').forEach(el => {
      scrolls[el.dataset.scroll] = { top: el.scrollTop, left: el.scrollLeft };
    });
    const winX = window.scrollX, winY = window.scrollY;

    root.innerHTML = render(app.state, app);

    // restore select values (value can't be expressed as plain markup reliably)
    root.querySelectorAll('select[data-value]').forEach(el => { el.value = el.dataset.value; });
    root.querySelectorAll('[data-scroll]').forEach(el => {
      const s = scrolls[el.dataset.scroll];
      if (s) { el.scrollTop = s.top; el.scrollLeft = s.left; }
    });
    window.scrollTo(winX, winY);
    if (focusKey != null) {
      const el = root.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (selStart != null) { try { el.setSelectionRange(selStart, selEnd); } catch { /* number inputs */ } }
      }
    }
    if (afterRender) afterRender(app.state, app);
  }

  for (const [domEvent, attr] of EVENTS) {
    const capture = domEvent === 'blur'; // blur doesn't bubble
    root.addEventListener(domEvent, e => {
      let el = e.target;
      while (el && el !== root) {
        if (el.dataset && el.dataset[attr]) {
          const fn = actions[el.dataset[attr]];
          if (fn) { fn.call(app, e, el.dataset, el); return; }
        }
        el = el.parentElement;
      }
    }, capture);
  }

  doRender();
  return app;
}
