"use client";

import { useEffect, useRef, useState } from "react";
import type { Parcel, TypeaheadSuggestion } from "@/lib/schemas";

/**
 * Milestone 1 harness: address autocomplete → satellite thumbnail →
 * "Is this your property?" confirm, with manual-entry fallback.
 *
 * This is a deliberately plain test page. The production widget UI (mockup —
 * sliders, dropdown, live SVG, range display) is Milestone 3.
 */
export default function Page() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TypeaheadSuggestion[]>([]);
  const [mock, setMock] = useState(false);
  const [selected, setSelected] = useState<TypeaheadSuggestion | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [manualSqft, setManualSqft] = useState("");
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced typeahead.
  useEffect(() => {
    if (selected) return; // don't re-search after a pick
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/typeahead?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setMock(Boolean(data.mock));
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, selected]);

  async function pick(s: TypeaheadSuggestion) {
    setSelected(s);
    setQuery(s.label);
    setSuggestions([]);
    setConfirmed(null);
    setLoading(true);
    const res = await fetch(
      `/api/parcel?lat=${s.lat}&lon=${s.lon}&address=${encodeURIComponent(s.label)}`,
    );
    const data = await res.json();
    setParcel(data.parcel ?? null);
    setLoading(false);
  }

  function reset() {
    setSelected(null);
    setParcel(null);
    setConfirmed(null);
    setQuery("");
    setManualSqft("");
  }

  const effectiveSqft = parcel?.lotSqft ?? (manualSqft ? Number(manualSqft) : null);

  return (
    <div className="wrap">
      <div className="card">
        <span className="tag">Milestone 1 · Property lookup</span>
        <h1>Get your instant lawn quote</h1>

        <label className="field" htmlFor="address">
          Address
        </label>
        <input
          id="address"
          type="text"
          placeholder="Start typing a US address…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setSelected(null);
            setParcel(null);
            setQuery(e.target.value);
          }}
        />

        {suggestions.length > 0 && (
          <ul className="suggestions" role="listbox" aria-label="Address suggestions">
            {suggestions.map((s) => (
              <li
                key={s.parcelId || s.label}
                role="option"
                tabIndex={0}
                aria-selected={false}
                onClick={() => pick(s)}
                onKeyDown={(e) => (e.key === "Enter" ? pick(s) : null)}
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}

        {mock && suggestions.length > 0 && (
          <p className="note">
            ⚠️ Showing mock results — no <code>REGRID_API_TOKEN</code> configured.
          </p>
        )}

        {loading && <p className="note">Looking up parcel…</p>}

        {parcel && (
          <>
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/static-image?lat=${parcel.lat}&lon=${parcel.lon}`}
                alt={`Satellite view of ${parcel.address ?? "the property"}`}
              />
            </div>

            <div className="confirm-row">
              <span>Is this your property?</span>
              <div className="btns">
                <button
                  className="primary"
                  aria-pressed={confirmed === true}
                  onClick={() => setConfirmed(true)}
                >
                  Yes
                </button>
                <button aria-pressed={confirmed === false} onClick={reset}>
                  No
                </button>
              </div>
            </div>

            {!parcel.verified && (
              <>
                <p className="note">
                  We couldn&apos;t verify this lot&apos;s size automatically. Enter
                  your approximate lot size to continue — we&apos;ll confirm on-site.
                </p>
                <label className="field" htmlFor="sqft">
                  Approximate lot size (sq ft)
                </label>
                <input
                  id="sqft"
                  type="number"
                  min={500}
                  placeholder="e.g. 8000"
                  value={manualSqft}
                  onChange={(e) => setManualSqft(e.target.value)}
                />
              </>
            )}

            {confirmed && (
              <dl className="facts">
                <dt>Lot size</dt>
                <dd>
                  {effectiveSqft ? `${effectiveSqft.toLocaleString()} sq ft` : "—"}{" "}
                  <span className={`badge ${parcel.verified ? "verified" : "manual"}`}>
                    {parcel.verified ? "verified" : parcel.lotSource}
                  </span>
                </dd>
                <dt>Structure on parcel</dt>
                <dd>
                  {parcel.hasStructure === null
                    ? "unknown"
                    : parcel.hasStructure
                      ? "yes"
                      : "no (open lot)"}
                </dd>
                <dt>Centroid</dt>
                <dd>
                  {parcel.lat.toFixed(5)}, {parcel.lon.toFixed(5)}
                </dd>
                <p className="note" style={{ margin: 0 }}>
                  ✅ Property confirmed. Next milestone wires these facts into the
                  estimate engine.
                </p>
              </dl>
            )}
          </>
        )}
      </div>
    </div>
  );
}
