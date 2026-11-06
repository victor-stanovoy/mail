"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function Nav() {
  const { session, me, signOut } = useAuth();
  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden>✉</span> ViennaMail
      </Link>
      <nav>
        <Link href="/sender">Send</Link>
        {me?.role === "courier" && <Link href="/courier">Courier</Link>}
        {session ? (
          <button className="link" onClick={signOut}>Sign out</button>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
