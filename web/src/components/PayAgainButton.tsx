"use client";
import { useState } from "react";

export function PayAgainButton({ reference, label = "Pay now" }: { reference: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/payments/paystack/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference }),
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.paymentUrl) window.location.href = d.paymentUrl;
          else {
            setError(d.error ?? "Couldn't start payment. Please try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening Paystack…" : label}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </>
  );
}
