import { render } from "preact";
import { Widget, type WidgetProps } from "./Widget";
import { STYLES } from "./styles";

/**
 * Public mount API. Attaches a Shadow DOM root to the given element so the
 * widget is fully isolated from the host page's CSS (and vice-versa), injects
 * the scoped styles, and renders the Preact app.
 *
 * The inline-embed bootstrap (reads data-business-id from the <script> tag)
 * lands in Milestone 5; it will call this same `mount`.
 */
export function mount(target: Element, opts: WidgetProps = {}): void {
  const host = target.shadowRoot ?? target.attachShadow({ mode: "open" });
  host.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = STYLES;
  host.appendChild(style);

  const root = document.createElement("div");
  host.appendChild(root);

  render(<Widget {...opts} />, root);
}

// Expose a small global so a plain <script> can mount the widget.
declare global {
  interface Window {
    LawnWidget?: { mount: typeof mount };
  }
}
if (typeof window !== "undefined") {
  window.LawnWidget = { mount };
}

export type { WidgetProps };
