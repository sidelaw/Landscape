"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-wrap" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const supabase = createBrowserSupabase();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Contractor sign in</h1>
          <p className="muted">
            Accounts require Supabase. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (plus the server keys) to enable
            sign in.
          </p>
        </div>
      </main>
    );
  }

  async function submit(e: Event | React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fn =
      mode === "signin"
        ? supabase!.auth.signInWithPassword({ email, password })
        : supabase!.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (mode === "signup") {
      setMsg("Account created. If email confirmation is on, check your inbox, then sign in.");
      setMode("signin");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>{mode === "signin" ? "Contractor sign in" : "Create your account"}</h1>
        <label className="lbl" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="inp"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <label className="lbl" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="inp"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        {msg && <p className="muted">{msg}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
