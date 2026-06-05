import { useEffect, useRef, useState } from "preact/hooks";
import {
  Api,
  isValidEmail,
  isValidUsPhone,
  looksLikePhone,
  LAST_CUT_OPTIONS,
  type LastCutOption,
  type Parcel,
  type QuoteResult,
  type Suggestion,
} from "./api";
import { Landscape } from "./Landscape";

export interface WidgetProps {
  businessId?: string;
  apiBase?: string;
}

const OBSTRUCTION_LABELS = ["None", "A little", "Some", "A lot"];
const TERRAIN_LABELS = ["Flat", "Gentle", "Some slope", "Small hills"];

function bucket(v: number, labels: string[]): string {
  return labels[Math.min(labels.length - 1, Math.round(v * (labels.length - 1)))];
}

export function Widget({ businessId, apiBase = "" }: WidgetProps) {
  const api = useRef(new Api(apiBase, businessId)).current;

  // Address / property
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mock, setMock] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [manualSqft, setManualSqft] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Conditions
  const [lastCutIdx, setLastCutIdx] = useState(1); // "2–3 weeks"
  const [obstructions, setObstructions] = useState(0.5);
  const [terrain, setTerrain] = useState(0.25);
  const [recurring, setRecurring] = useState(false);

  // Quote / contact
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(false);

  // Debounced typeahead
  useEffect(() => {
    if (selected) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const data = await api.typeahead(query);
      setSuggestions(data.suggestions);
      setMock(Boolean(data.mock));
    }, 250);
  }, [query, selected]);

  async function pick(s: Suggestion) {
    setSelected(s);
    setQuery(s.label);
    setSuggestions([]);
    setConfirmed(null);
    setParcel(await api.parcel(s));
    setQuote(null);
  }

  function resetAddress() {
    setSelected(null);
    setParcel(null);
    setConfirmed(null);
    setQuery("");
    setManualSqft("");
    setQuote(null);
  }

  const effectiveSqft = parcel?.lotSqft ?? (manualSqft ? Number(manualSqft) : null);
  const ready =
    confirmed === true && effectiveSqft !== null && effectiveSqft > 0 && !quoting;

  async function getQuote() {
    if (!ready || !parcel || effectiveSqft === null) return;
    setQuoting(true);
    setQuoteError(false);
    setQuote(null);
    const res = await api.quote({
      businessId,
      lotSqft: effectiveSqft,
      hasStructure: parcel.hasStructure,
      lastCut: LAST_CUT_OPTIONS[lastCutIdx].value as LastCutOption,
      obstructions,
      terrain,
      recurring,
    });
    setQuoting(false);
    if ("error" in res) setQuoteError(true);
    else setQuote(res);
  }

  return (
    <div class="lc-card">
      <h1 class="lc-title">Get your instant lawn quote</h1>

      {/* Address */}
      <label class="lc-label" for="lc-address">
        Address
      </label>
      <div class="lc-input-wrap">
        <input
          id="lc-address"
          class="lc-input"
          type="text"
          autoComplete="off"
          placeholder="Enter your US address"
          value={query}
          onInput={(e) => {
            setSelected(null);
            setParcel(null);
            setQuote(null);
            setQuery((e.target as HTMLInputElement).value);
          }}
        />
        <span class="lc-pin" aria-hidden="true">
          <PinIcon />
        </span>
      </div>

      {suggestions.length > 0 && (
        <ul class="lc-suggestions" role="listbox" aria-label="Address suggestions">
          {suggestions.map((s) => (
            <li
              key={s.parcelId || s.label}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => pick(s)}
              onKeyDown={(e) => e.key === "Enter" && pick(s)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {mock && suggestions.length > 0 && (
        <p class="lc-note lc-warn">Demo mode — no Regrid key configured.</p>
      )}

      {/* Satellite confirm */}
      {parcel && (
        <>
          <div class="lc-thumb">
            <img
              src={api.staticImageUrl(parcel.lat, parcel.lon)}
              alt={`Satellite view of ${parcel.address ?? "the property"}`}
            />
          </div>
          <div class="lc-confirm">
            <span>Is this your property?</span>
            <div class="lc-yn">
              <button
                class="lc-btn"
                aria-pressed={confirmed === true}
                onClick={() => setConfirmed(true)}
              >
                Yes
              </button>
              <button
                class="lc-btn"
                aria-pressed={confirmed === false}
                onClick={resetAddress}
              >
                No
              </button>
            </div>
          </div>
          {!parcel.verified && confirmed === true && (
            <>
              <p class="lc-note">
                We couldn&apos;t verify this lot&apos;s size automatically. Enter your
                approximate lot size to continue.
              </p>
              <label class="lc-label" for="lc-sqft">
                Approximate lot size <span class="lc-sub">(sq ft)</span>
              </label>
              <input
                id="lc-sqft"
                class="lc-input"
                type="number"
                min={500}
                placeholder="e.g. 8000"
                value={manualSqft}
                onInput={(e) => setManualSqft((e.target as HTMLInputElement).value)}
              />
            </>
          )}
        </>
      )}

      {/* Conditions (always interactive; the scene mirrors them live) */}
      <Slider
        name="Obstructions"
        value={obstructions}
        valueLabel={bucket(obstructions, OBSTRUCTION_LABELS)}
        onChange={setObstructions}
      />
      <Slider
        name="Ground level"
        value={terrain}
        valueLabel={bucket(terrain, TERRAIN_LABELS)}
        onChange={setTerrain}
      />

      <Landscape lastCutIndex={lastCutIdx} obstructions={obstructions} terrain={terrain} />

      <label class="lc-label" for="lc-lastcut">
        When was it last cut?
      </label>
      <select
        id="lc-lastcut"
        class="lc-select"
        value={String(lastCutIdx)}
        onChange={(e) => setLastCutIdx(Number((e.target as HTMLSelectElement).value))}
      >
        {LAST_CUT_OPTIONS.map((o, i) => (
          <option key={o.value} value={String(i)}>
            {o.label}
          </option>
        ))}
      </select>

      <label class="lc-check">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring((e.target as HTMLInputElement).checked)}
        />
        <span>
          Add recurring lawn care <span class="lc-off">(15% off)</span>
        </span>
      </label>

      <button class="lc-cta" disabled={!ready} onClick={getQuote}>
        {quoting ? "Getting your quote…" : "Get quote"}
      </button>
      {confirmed !== true && (
        <p class="lc-note">Confirm your property above to get a quote.</p>
      )}
      {quoteError && (
        <p class="lc-note lc-warn">
          Something went wrong getting your quote. Please try again.
        </p>
      )}

      {quote && <Estimate quote={quote} businessId={businessId} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Slider({
  name,
  value,
  valueLabel,
  onChange,
}: {
  name: string;
  value: number;
  valueLabel: string;
  onChange: (v: number) => void;
}) {
  const id = `lc-${name.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <>
      <div class="lc-slider-head">
        <label class="lc-name" for={id}>
          {name}
        </label>
        <span class="lc-val">{valueLabel}</span>
      </div>
      <input
        id={id}
        class="lc-range"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={valueLabel}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
    </>
  );
}

function Estimate({
  quote,
  businessId,
}: {
  quote: QuoteResult;
  businessId?: string;
}) {
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);

  const phone = looksLikePhone(contact);
  const contactValid = phone ? isValidUsPhone(contact) : isValidEmail(contact);
  // TCPA: if a phone is given, SMS consent is required before submit.
  const consentOk = !phone || smsConsent;
  const canSubmit = contactValid && consentOk;

  return (
    <div class="lc-estimate">
      <span class="lc-logo" aria-hidden="true">
        <GrassIcon />
      </span>
      <h2>Your lawn care estimate</h2>

      {quote.kind === "range" ? (
        <>
          <div class="lc-range">{quote.display}</div>
          <div class="lc-range-label">Estimate, subject to on-site confirmation</div>
        </>
      ) : (
        <p class="lc-custom">This property needs a custom quote</p>
      )}

      {submitted ? (
        <p class="lc-note" role="status">
          ✅ Thanks{name ? `, ${name.split(" ")[0]}` : ""}! Your{" "}
          {quote.kind === "range" ? "price is reserved" : "request is in"} — the
          contractor will reach out shortly.
        </p>
      ) : (
        <div class="lc-contact">
          <label class="lc-label" for="lc-contact">
            Email or phone number
          </label>
          <input
            id="lc-contact"
            class="lc-input"
            type="text"
            placeholder="you@example.com or (555) 555-1234"
            value={contact}
            onInput={(e) => setContact((e.target as HTMLInputElement).value)}
            onBlur={() => setTouched(true)}
          />
          {touched && contact && !contactValid && (
            <p class="lc-note lc-warn">Enter a valid US email or phone number.</p>
          )}

          <label class="lc-label" for="lc-name">
            Name <span class="lc-sub">(optional)</span>
          </label>
          <input
            id="lc-name"
            class="lc-input"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />

          {phone && (
            <label class="lc-check">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent((e.target as HTMLInputElement).checked)}
              />
              <span>Text me updates about my quote</span>
            </label>
          )}

          <button
            class="lc-cta"
            disabled={!canSubmit}
            onClick={() => setSubmitted(true)}
          >
            <LockIcon /> {quote.kind === "range" ? "Lock in this price" : "Request a quote"}
          </button>
          <div class="lc-shield">
            <ShieldIcon /> No payment now. No obligation.
          </div>
          <p class="lc-note">
            Lead delivery (storage + contractor email) is wired in Milestone 6.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Icons (inline, no assets) ─────────────────────────────────────────────────

const PinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const GrassIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6cc24a" stroke-width="2" stroke-linecap="round">
    <path d="M12 21V11M12 11c0-3-2-5-4-6 0 3 1 5 4 6zM12 11c0-3 2-5 4-6 0 3-1 5-4 6zM6 21c0-4 1-6 3-8M18 21c0-4-1-6-3-8" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
  </svg>
);
