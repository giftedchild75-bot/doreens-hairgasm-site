"use client";
import { useState } from "react";

import { NEWSLETTER_CONSENT_TEXT as CONSENT_TEXT } from "@/lib/consent";

export function Newsletter() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("consent")) {
      setState("error");
      setMsg("Please tick the consent box to subscribe.");
      return;
    }
    setState("busy");
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), consent: true }) });
    const d = await res.json().catch(() => ({}));
    setState(res.ok ? "done" : "error");
    setMsg(d.message ?? (res.ok ? "You're subscribed." : "Something went wrong — try again."));
  }
  if (state === "done") return <p className="notice success" role="status" style={{ maxWidth: 460, margin: "0 auto" }}>{msg}</p>;
  return (
    <form onSubmit={submit} noValidate>
      <div className="newsletter">
        <label className="sr-only" htmlFor="nl-email">Email address</label>
        <input id="nl-email" name="email" type="email" required className="field" placeholder="Your email address" autoComplete="email" />
        <button className="btn btn-primary" disabled={state === "busy"}>Subscribe</button>
      </div>
      <label className="newsletter-consent" style={{ display: "flex", gap: 8, justifyContent: "center", maxWidth: 460, margin: "10px auto 0" }}>
        <input type="checkbox" name="consent" value="1" /> <span>{CONSENT_TEXT}</span>
      </label>
      {state === "error" && <p className="newsletter-consent" role="alert" style={{ color: "#8c1d18" }}>{msg}</p>}
    </form>
  );
}
