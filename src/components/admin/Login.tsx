"use client";
import { useState } from "react";
import { useNotify } from "./Notices";
export function Login() {
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  return (
    <div className="admin-login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
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
            notify({
              tone: "error",
              text: e instanceof Error ? e.message : "Unable to sign in",
            });
            setBusy(false);
          }
        }}
      >
        <h1>Welcome back</h1>
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
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
