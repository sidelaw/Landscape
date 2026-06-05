import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { getOrCreateBusinessForCurrentUser } from "@/lib/business";
import { listLeadsForCurrentUser, type StoredLead } from "@/lib/leads";
import { getFunnel } from "@/lib/analytics";
import { ConfigForm } from "./ConfigForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Dev without Supabase: show a clear notice rather than a broken page.
  if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <main className="dash-wrap">
        <div className="dash-card">
          <h1>Dashboard</h1>
          <p className="muted">
            Contractor accounts require Supabase. Add <code>SUPABASE_URL</code>,{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run the migrations in{" "}
            <code>db/migrations</code>.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const business = await getOrCreateBusinessForCurrentUser();
  if (!business) {
    return (
      <main className="dash-wrap">
        <div className="dash-card">
          <h1>Dashboard</h1>
          <p className="muted">Couldn&apos;t load your business. Please retry.</p>
        </div>
      </main>
    );
  }

  const host = headers().get("host") ?? "your-domain.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const leads = await listLeadsForCurrentUser(business.id);
  const supabase = createServerSupabase();
  const funnel = supabase ? await getFunnel(supabase, business.id) : null;

  return (
    <main className="dash-wrap">
      <div className="dash-head">
        <div>
          <h1>{business.name}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost" type="submit">
            Sign out
          </button>
        </form>
      </div>

      {funnel && (
        <section className="dash-card">
          <h2>Conversion</h2>
          <div className="grid2">
            <Stat label="Addresses entered" value={funnel.address_entered} />
            <Stat label="Properties confirmed" value={funnel.property_confirmed} />
            <Stat label="Quotes shown" value={funnel.quote_shown} />
            <Stat label="Leads captured" value={funnel.lead_captured} />
          </div>
        </section>
      )}

      <LeadsInbox leads={leads} />

      <ConfigForm business={business} origin={origin} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function LeadsInbox({ leads }: { leads: StoredLead[] }) {
  return (
    <section className="dash-card">
      <h2>Leads ({leads.length})</h2>
      {leads.length === 0 ? (
        <p className="muted">No leads yet. They&apos;ll appear here as homeowners submit quotes.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="leads">
            <thead>
              <tr>
                <th>When</th>
                <th>Contact</th>
                <th>Quote</th>
                <th>Lot</th>
                <th>SMS</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td>
                    {l.name && <div>{l.name}</div>}
                    <div className="muted">{l.email || l.phone || "—"}</div>
                  </td>
                  <td>{l.quote?.display ?? (l.quote?.kind === "custom_quote" ? "Custom" : "—")}</td>
                  <td className="muted">
                    {l.inputs?.lotSqft ? `${Number(l.inputs.lotSqft).toLocaleString()} sqft` : "—"}
                    {l.lotSource ? ` (${l.lotSource})` : ""}
                  </td>
                  <td>{l.phone ? (l.smsConsent ? "✓" : "✗") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
