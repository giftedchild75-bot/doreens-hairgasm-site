/**
 * Transactional email via an outbox table.
 *
 * Every notification the system decides to send is recorded first (with a
 * dedupe key, so webhook retries can't send twice), then delivered through
 * Resend. When no provider is configured the row is marked `not_configured` —
 * it is never reported as sent.
 */
import { eq } from "drizzle-orm";
import { emailMessages } from "@/db/schema";
import { env, brand } from "@/lib/env";
import type { Executor } from "./pricing";

export interface EmailInput {
  to: string;
  template: string;
  subject: string;
  html: string;
  text: string;
  orderId?: string | null;
  dedupeKey?: string | null;
}

export type EmailSender = (msg: { to: string; subject: string; html: string; text: string }) => Promise<{ id: string }>;

let senderOverride: EmailSender | null = null;
/** Test hook. */
export function setEmailSenderForTesting(s: EmailSender | null) {
  senderOverride = s;
}

async function resendSend(msg: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? "unknown error"}`);
  return { id: body.id };
}

function activeSender(): EmailSender | null {
  if (senderOverride) return senderOverride;
  if (env.resendKey && env.emailFrom) return resendSend;
  return null;
}

/** Returns the outbox row id, or null if this dedupe key was already used. */
export async function queueEmail(db: Executor, input: EmailInput): Promise<string | null> {
  const [row] = await db
    .insert(emailMessages)
    .values({
      toEmail: input.to,
      template: input.template,
      subject: input.subject,
      orderId: input.orderId ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: emailMessages.dedupeKey })
    .returning({ id: emailMessages.id });
  if (!row) return null;

  const sender = activeSender();
  if (!sender) {
    await db.update(emailMessages).set({ status: "not_configured" }).where(eq(emailMessages.id, row.id));
    return row.id;
  }
  try {
    const { id } = await sender({ to: input.to, subject: input.subject, html: input.html, text: input.text });
    await db.update(emailMessages).set({ status: "sent", providerMessageId: id }).where(eq(emailMessages.id, row.id));
  } catch (err) {
    await db
      .update(emailMessages)
      .set({ status: "failed", error: String((err as Error).message ?? err).slice(0, 500) })
      .where(eq(emailMessages.id, row.id));
  }
  return row.id;
}

// ---------------------------------------------------------------- templates

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmail(heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#F6E9EB;font-family:Helvetica,Arial,sans-serif;color:#1C1211">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-family:Georgia,serif;font-size:22px;color:#6D1029;margin:0 0 24px">${esc(brand.name)}</p>
<div style="background:#fff;border-radius:12px;padding:28px">
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:0 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;color:#4a3f3a">${esc(p)}</p>`).join("\n")}
${cta ? `<p style="margin-top:24px"><a href="${esc(cta.url)}" style="background:#6D1029;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:14px">${esc(cta.label)}</a></p>` : ""}
</div>
<p style="font-size:12px;color:#786C65;margin-top:20px">${esc(brand.name)} · ${esc(brand.location)}</p>
</div></body></html>`;
  const text = [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");
  return { html, text };
}
