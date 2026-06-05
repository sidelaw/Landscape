"use client";

import { useEffect, useRef } from "react";

/**
 * Loads the standalone widget bundle (/embed/widget.js) and mounts it into a
 * Shadow DOM container — the same path a contractor's site uses. Reused by the
 * local demo page and the hosted /q/[businessId] quote page (same-origin, so
 * apiBase defaults to "").
 */
export function WidgetMount({ businessId }: { businessId?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const doMount = () => window.LawnWidget?.mount(el, { businessId, apiBase: "" });

    if (window.LawnWidget) {
      doMount();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-lawn-widget]");
    if (existing) {
      existing.addEventListener("load", doMount);
      return () => existing.removeEventListener("load", doMount);
    }
    const script = document.createElement("script");
    script.src = "/embed/widget.js";
    script.async = true;
    script.dataset.lawnWidget = "true";
    script.onload = doMount;
    document.body.appendChild(script);
  }, [businessId]);

  return <div ref={ref} />;
}

declare global {
  interface Window {
    LawnWidget?: {
      mount: (el: Element, opts?: { businessId?: string; apiBase?: string }) => void;
    };
  }
}
