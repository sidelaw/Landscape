import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { getOrCreateBusinessForCurrentUser } from "@/lib/business";
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

      <ConfigForm business={business} origin={origin} />
    </main>
  );
}
