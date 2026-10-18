/**
 * Central, validated access to configuration. Secrets are only ever read on
 * the server; nothing here is exposed to the browser (no NEXT_PUBLIC_ secrets).
 */
export const env = {
  get siteUrl() {
    return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get paystackSecret() {
    return process.env.PAYSTACK_SECRET_KEY ?? "";
  },
  /**
   * Payments are OFF unless explicitly enabled. Live keys (sk_live_…) additionally
   * require PAYSTACK_LIVE_APPROVED=true, so a pasted live key can't silently start
   * charging real cards before the owner has verified the setup.
   */
  get paymentsMode(): "disabled" | "test" | "live" {
    const key = this.paystackSecret;
    if (process.env.PAYMENTS_ENABLED !== "true" || !key) return "disabled";
    if (key.startsWith("sk_test_")) return "test";
    if (key.startsWith("sk_live_") && process.env.PAYSTACK_LIVE_APPROVED === "true") return "live";
    return "disabled";
  },
  get resendKey() {
    return process.env.RESEND_API_KEY ?? "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM ?? "";
  },
  get whatsappNumber() {
    return process.env.WHATSAPP_NUMBER ?? "2349130213524";
  },
  get reservationMinutes() {
    return Number(process.env.STOCK_RESERVATION_MINUTES ?? 60);
  },
};

export const brand = {
  name: "Doreen's Hairgasm",
  tagline: "Luxury Wigs. Flawless Fit.",
  instagramUrl: "https://www.instagram.com/doreens_hairgasm",
  instagramHandle: "doreens_hairgasm",
  tiktokUrl: "https://www.tiktok.com/@doreens.hairgasm",
  tiktokHandle: "doreens.hairgasm",
  featuredTikTokVideoUrl: "https://www.tiktok.com/@doreens.hairgasm/video/7645349489930145031",
  location: "Owerri, Nigeria",
};

export function whatsappLink(message: string): string {
  return `https://wa.me/${env.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
