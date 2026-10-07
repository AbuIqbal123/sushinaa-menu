"use client";
import Link from "next/link";
import { useState } from "react";
export function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="admin-login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/admin/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(data)),
            });
            if (!r.ok) throw new Error((await r.json()).error);
            window.location.assign("/admin");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to sign in");
            setBusy(false);
          }
        }}
      >
        <p className="muted">MENU ADMINISTRATION</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your restaurant menu.</p>
        <label>
          Username
          <input name="username" autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ marginTop: 20 }}>
          <Link href="/">Back to the menu</Link>
        </p>
      </form>
    </div>
  );
}
