/**
 * Widget styles, injected as a single <style> inside the Shadow DOM root.
 * Scoped under :host so nothing leaks to (or from) the host page.
 * Visual source of truth: the mockup (dark card, green accents).
 */
export const STYLES = `
:host, * { box-sizing: border-box; }
:host {
  --lc-bg: #16191a;
  --lc-bg-2: #1e2224;
  --lc-text: #f3f5f3;
  --lc-muted: #9aa39a;
  --lc-green: #6cc24a;
  --lc-green-bright: #7ed957;
  --lc-border: #2a2f30;
  --lc-radius: 16px;
  all: initial;
  display: block;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--lc-text);
  line-height: 1.4;
}
.lc-card {
  background: var(--lc-bg);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius);
  padding: 26px 22px;
  max-width: 440px;
  width: 100%;
  margin: 0 auto;
}
.lc-title { font-size: 23px; font-weight: 800; margin: 0 0 18px; }
.lc-label { display: block; font-weight: 700; font-size: 14px; margin: 16px 0 7px; }
.lc-sub { color: var(--lc-muted); font-weight: 400; }

.lc-input-wrap { position: relative; }
.lc-input {
  width: 100%;
  background: var(--lc-bg-2);
  border: 1px solid var(--lc-border);
  border-radius: 11px;
  color: var(--lc-text);
  padding: 13px 42px 13px 14px;
  font-size: 15px;
  outline: none;
  font-family: inherit;
}
.lc-input:focus { border-color: var(--lc-green); }
.lc-pin {
  position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
  color: var(--lc-muted); pointer-events: none;
}

.lc-suggestions {
  list-style: none; margin: 6px 0 0; padding: 0;
  border: 1px solid var(--lc-border); border-radius: 11px; overflow: hidden;
  background: var(--lc-bg-2);
}
.lc-suggestions li { padding: 11px 14px; cursor: pointer; font-size: 14px; }
.lc-suggestions li + li { border-top: 1px solid var(--lc-border); }
.lc-suggestions li:hover, .lc-suggestions li:focus { background: #283133; outline: none; }

.lc-thumb {
  margin-top: 14px; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--lc-border); aspect-ratio: 16 / 10; background: var(--lc-bg-2);
}
.lc-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.lc-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 13px; }
.lc-confirm > span { font-weight: 700; }
.lc-yn { display: flex; gap: 8px; }

button { font-family: inherit; }
.lc-btn {
  cursor: pointer; border-radius: 10px; border: 1px solid var(--lc-border);
  background: var(--lc-bg-2); color: var(--lc-text); padding: 9px 18px; font-size: 14px; font-weight: 600;
}
.lc-btn[aria-pressed="true"] { border-color: var(--lc-green); color: var(--lc-green-bright); }
.lc-btn:focus-visible, .lc-input:focus-visible { outline: 2px solid var(--lc-green-bright); outline-offset: 2px; }

.lc-slider-head { display: flex; justify-content: space-between; align-items: baseline; margin: 18px 0 6px; }
.lc-slider-head .lc-name { font-weight: 700; font-size: 15px; }
.lc-slider-head .lc-val { color: var(--lc-muted); font-size: 14px; }
input[type="range"].lc-range {
  -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px;
  background: var(--lc-border); outline: none; margin: 4px 0 2px;
}
input[type="range"].lc-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; border: 3px solid var(--lc-green); cursor: pointer;
}
input[type="range"].lc-range::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid var(--lc-green); cursor: pointer;
}

.lc-scene { margin: 16px 0 4px; border-radius: 12px; overflow: hidden; border: 1px solid var(--lc-border); background: #0c1410; }
.lc-scene svg { display: block; width: 100%; height: auto; }

.lc-select {
  width: 100%; background: var(--lc-bg-2); border: 1px solid var(--lc-border); border-radius: 11px;
  color: var(--lc-text); padding: 13px 14px; font-size: 15px; outline: none; font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239aa39a' stroke-width='2'><path d='M4 6l4 4 4-4'/></svg>");
  background-repeat: no-repeat; background-position: right 14px center;
}
.lc-select:focus { border-color: var(--lc-green); }

.lc-check { display: flex; align-items: center; gap: 10px; margin-top: 16px; cursor: pointer; font-size: 15px; }
.lc-check input { width: 18px; height: 18px; accent-color: var(--lc-green); }
.lc-off { color: var(--lc-green-bright); font-weight: 700; }

.lc-cta {
  width: 100%; margin-top: 20px; padding: 15px; border: none; border-radius: 12px;
  background: var(--lc-green); color: #08210a; font-weight: 800; font-size: 16px; cursor: pointer;
}
.lc-cta:disabled { opacity: .5; cursor: not-allowed; }
.lc-cta:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

.lc-note { font-size: 13px; color: var(--lc-muted); margin-top: 12px; line-height: 1.5; }
.lc-warn { color: #e6b43c; }

/* Estimate section */
.lc-estimate { margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--lc-border); text-align: center; }
.lc-logo {
  width: 56px; height: 56px; border-radius: 50%; border: 2px solid var(--lc-green);
  display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;
}
.lc-estimate h2 { font-size: 22px; font-weight: 800; margin: 0 0 14px; }
.lc-range { font-size: 52px; font-weight: 800; color: var(--lc-green-bright); margin: 6px 0; letter-spacing: -1px; }
.lc-range-label { color: var(--lc-muted); font-size: 14px; margin-bottom: 4px; }
.lc-custom { font-size: 20px; font-weight: 700; margin: 10px 0; }

.lc-contact { text-align: left; margin-top: 20px; }
.lc-shield { display: inline-flex; align-items: center; gap: 7px; color: var(--lc-muted); font-size: 13px; margin-top: 12px; justify-content: center; width: 100%; }

@media (prefers-reduced-motion: no-preference) {
  .lc-scene svg * { transition: all .25s ease; }
}
`;
