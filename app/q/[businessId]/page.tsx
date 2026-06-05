import type { Metadata } from "next";
import { getPublicConfig } from "@/lib/business";
import { WidgetMount } from "@/app/_components/WidgetMount";

export const dynamic = "force-dynamic";

/**
 * Hosted quote page — a standalone, shareable URL (link / QR target) for
 * contractors without a website. Renders the same widget bundle as the embed,
 * scoped to the business id in the path.
 */
export async function generateMetadata({
  params,
}: {
  params: { businessId: string };
}): Promise<Metadata> {
  const config = await getPublicConfig(params.businessId);
  return {
    title: `${config.name} — Instant lawn quote`,
    description: "Get an instant lawn-care estimate for your property.",
  };
}

export default async function HostedQuotePage({
  params,
}: {
  params: { businessId: string };
}) {
  const config = await getPublicConfig(params.businessId);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "40px 16px",
        background: "#0a0c0a",
      }}
    >
      <h1 style={{ color: "#f3f5f3", fontSize: 20, margin: "0 0 18px", fontWeight: 800 }}>
        {config.name}
      </h1>
      <WidgetMount businessId={params.businessId} />
    </main>
  );
}
