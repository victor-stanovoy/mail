"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/sender";

  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const sb = getSupabase();
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace(dest);
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setError(error.message);
      else if (data.session) router.replace(dest);
      else setNotice("Check your inbox to confirm your email address, then sign in.");
    }
    setBusy(false);
  }

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h1>{mode === "in" ? "Sign in" : "Create an account"}</h1>
      {mode === "up" && (
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="good">{notice}</p>}
      <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</button>
      <button type="button" className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setNotice(null); }}>
        {mode === "in" ? "No account yet? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
