import { WidgetMount } from "./_components/WidgetMount";

/**
 * Local demo / preview page. Mounts the real widget bundle in a Shadow DOM
 * container — exactly how a contractor's site embeds it. The hosted, per-
 * contractor page lives at /q/[businessId].
 */
export default function Page() {
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
      <WidgetMount businessId="demo" />
    </main>
  );
}
