import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { verifyEmail } from "@/server/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

export default async function VerifyPage({ searchParams }: PageProps<"/account/verify">) {
  const t = (await searchParams).t;
  const ok = typeof t === "string" && (await verifyEmail(await getDb(), t));
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 480, textAlign: "center" }}>
        <div className="page-head"><h1>{ok ? "Email confirmed" : "Link expired"}</h1></div>
        <p className={ok ? "notice success" : "notice error"}>
          {ok ? "Thanks — your account now shows your order history." : "This confirmation link is invalid or has already been used. Sign in to request a new one."}
        </p>
        <p style={{ marginTop: 24 }}><Link className="btn btn-primary" href="/account">Go to my account</Link></p>
      </div>
    </div>
  );
}
