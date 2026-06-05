import { render } from "preact";
import { Widget, type WidgetProps } from "./Widget";
import { STYLES } from "./styles";

/**
 * Public mount API. Attaches a Shadow DOM root to the given element so the
 * widget is fully isolated from the host page's CSS (and vice-versa), injects
 * the scoped styles, and renders the Preact app.
 */
const mountedRoots = new WeakMap<ShadowRoot, HTMLElement>();

export function mount(target: Element, opts: WidgetProps = {}): void {
  const host = target.shadowRoot ?? target.attachShadow({ mode: "open" });

  // Tear down a previous mount (effects/timers) before re-rendering.
  const prev = mountedRoots.get(host);
  if (prev) render(null, prev);
  host.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = STYLES;
  host.appendChild(style);

  const root = document.createElement("div");
  host.appendChild(root);
  mountedRoots.set(host, root);

  render(<Widget {...opts} />, root);
}

declare global {
  interface Window {
    LawnWidget?: { mount: typeof mount };
  }
}

// ── Inline-embed bootstrap ────────────────────────────────────────────────────
// One file is both the widget bundle and the embed bootstrap. When loaded via
//   <script src=".../embed/widget.js" data-business-id="..." async></script>
// it auto-creates a container next to the script and mounts itself. The API
// base is derived from the script's own origin so a contractor's site (any
// domain) calls back to our server for the proxied, keyed requests.

const currentScript = (typeof document !== "undefined" &&
  (document.currentScript as HTMLScriptElement | null)) || null;

function originFromScript(script: HTMLScriptElement | null): string {
  try {
    if (script?.src) return new URL(script.src).origin;
  } catch {
    /* ignore */
  }
  return "";
}

function autoBoot(script: HTMLScriptElement) {
  const businessId = script.getAttribute("data-business-id") ?? undefined;
  const apiBase = script.getAttribute("data-api-base") ?? originFromScript(script);

  // Mount into an explicit target if given, else a div inserted after the script.
  const sel = script.getAttribute("data-target");
  let target: Element | null = sel ? document.querySelector(sel) : null;
  if (!target) {
    target = document.createElement("div");
    target.className = "lawn-widget";
    script.parentNode?.insertBefore(target, script.nextSibling);
  }
  mount(target, { businessId, apiBase });
}

if (typeof window !== "undefined") {
  window.LawnWidget = { mount };
  if (currentScript && currentScript.hasAttribute("data-business-id")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => autoBoot(currentScript));
    } else {
      autoBoot(currentScript);
    }
  }
}

export type { WidgetProps };
