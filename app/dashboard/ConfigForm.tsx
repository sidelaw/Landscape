"use client";

import { useState } from "react";
import { LAST_CUT_OPTIONS, type LastCutOption, type PricingConfig } from "@/lib/config";
import type { Business } from "@/lib/business";
import { saveBusiness } from "./actions";

export function ConfigForm({ business, origin }: { business: Business; origin: string }) {
  const [name, setName] = useState(business.name);
  const [email, setEmail] = useState(business.notificationEmail ?? "");
  const [domains, setDomains] = useState(business.allowedDomains.join("\n"));
  const [p, setP] = useState<PricingConfig>(business.pricing);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const num =
    (key: keyof PricingConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setP({ ...p, [key]: Number(e.currentTarget.value) });

  const setCut = (opt: LastCutOption, v: number) =>
    setP({ ...p, lastCutMultipliers: { ...p.lastCutMultipliers, [opt]: v } });

  const snippet = `<script src="${origin}/embed/widget.js" data-business-id="${business.id}" async></script>`;

  async function save() {
    setBusy(true);
    setStatus(null);
    const res = await saveBusiness({
      name,
      notificationEmail: email.trim() || null,
      pricing: p,
      allowedDomains: domains
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean),
    });
    setBusy(false);
    setStatus(res.ok ? "Saved ✓" : `Error: ${res.error ?? "unknown"}`);
  }

  return (
    <>
      <section className="dash-card">
        <h2>Embed snippet</h2>
        <p className="muted">Paste this into your website where the quote widget should appear.</p>
        <pre className="snippet">{snippet}</pre>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </section>

      <section className="dash-card">
        <h2>Business</h2>
        <Field label="Business name">
          <input className="inp" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        </Field>
        <Field label="Lead notification email">
          <input
            className="inp"
            type="email"
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </Field>
        <Field label="Allowed embed domains (one per line)" hint="Used in Milestone 5 to block use of your business-id on other sites.">
          <textarea
            className="inp"
            rows={3}
            placeholder={"example.com\nwww.example.com"}
            value={domains}
            onChange={(e) => setDomains(e.currentTarget.value)}
          />
        </Field>
      </section>

      <section className="dash-card">
        <h2>Pricing</h2>
        <div className="grid2">
          <Field label="Base rate / 1,000 sq ft ($)">
            <input className="inp" type="number" step="0.01" value={p.baseRatePer1000Sqft} onChange={num("baseRatePer1000Sqft")} />
          </Field>
          <Field label="Minimum charge ($)">
            <input className="inp" type="number" step="1" value={p.minimumCharge} onChange={num("minimumCharge")} />
          </Field>
          <Field label="Obstruction multiplier max (×)">
            <input className="inp" type="number" step="0.01" value={p.obstructionMultiplierMax} onChange={num("obstructionMultiplierMax")} />
          </Field>
          <Field label="Terrain multiplier max (×)">
            <input className="inp" type="number" step="0.01" value={p.terrainMultiplierMax} onChange={num("terrainMultiplierMax")} />
          </Field>
          <Field label="Recurring discount (%)">
            <input className="inp" type="number" step="1" value={p.recurringDiscountPct} onChange={num("recurringDiscountPct")} />
          </Field>
          <Field label="Auto-quote cap ($)" hint="Above this, the widget shows a custom-quote path.">
            <input className="inp" type="number" step="1" value={p.autoQuoteCap} onChange={num("autoQuoteCap")} />
          </Field>
          <Field label="Range low (%)">
            <input className="inp" type="number" step="1" value={p.rangeLowPct} onChange={num("rangeLowPct")} />
          </Field>
          <Field label="Range high (%)">
            <input className="inp" type="number" step="1" value={p.rangeHighPct} onChange={num("rangeHighPct")} />
          </Field>
        </div>
      </section>

      <section className="dash-card">
        <h2>Last-cut multipliers</h2>
        <div className="grid2">
          {LAST_CUT_OPTIONS.map((o) => (
            <Field key={o.value} label={o.label}>
              <input
                className="inp"
                type="number"
                step="0.01"
                value={p.lastCutMultipliers[o.value]}
                onChange={(e) => setCut(o.value, Number(e.currentTarget.value))}
              />
            </Field>
          ))}
        </div>
      </section>

      <div className="dash-actions">
        <button className="btn-primary" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {status && <span className="muted">{status}</span>}
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
