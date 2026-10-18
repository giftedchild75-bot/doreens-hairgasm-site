import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { resetAction } from "../actions";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: PageProps<"/account/reset">) {
  const t = (await searchParams).t;
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="page-head"><h1>Choose a new password</h1></div>
        {typeof t !== "string" ? (
          <p className="notice error">This link is incomplete. <Link className="mini-link" href="/account/forgot">Request a new one</Link>.</p>
        ) : (
          <ActionForm action={resetAction} submitLabel="Update password">
            <input type="hidden" name="token" value={t} />
            <Field name="password" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." />
          </ActionForm>
        )}
        <p style={{ marginTop: 24 }}><Link className="mini-link" href="/account/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
