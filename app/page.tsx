"use client";

import { useEffect, useRef } from "react";

/**
 * Host page for local development / preview. It loads the standalone widget
 * bundle (/embed/widget.js) and mounts it into a Shadow DOM container — exactly
 * how a contractor's site will embed it (Milestone 5 adds the data-business-id
 * bootstrap + the hosted /q/[businessId] route). This page intentionally uses
 * the real bundle, not a React copy, to prove the embed renders in isolation.
 */
export default function Page() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function mount() {
      window.LawnWidget?.mount(el!, { businessId: "demo" });
    }

    if (window.LawnWidget) {
      mount();
      return;
    }
    const script = document.createElement("script");
    script.src = "/embed/widget.js";
    script.async = true;
    script.onload = mount;
    document.body.appendChild(script);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 16px",
        background: "#0a0c0a",
      }}
    >
      <nav className="nav">
        <a href="/dashboard">Contractor dashboard →</a>
      </nav>
      <div ref={ref} />
    </main>
  );
}

declare global {
  interface Window {
    LawnWidget?: { mount: (el: Element, opts?: { businessId?: string; apiBase?: string }) => void };
  }
}
