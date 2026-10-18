import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { registerAction } from "../actions";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="page-head"><h1>Create an account</h1><p>See your order history in one place. We&apos;ll only use your email for your orders unless you subscribe to our newsletter.</p></div>
        <ActionForm action={registerAction} submitLabel="Create account">
          <Field name="name" label="Name" autoComplete="name" />
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 10 characters." />
        </ActionForm>
        <p className="muted" style={{ marginTop: 24 }}>Already have an account? <Link className="mini-link" href="/account/login">Sign in</Link></p>
      </div>
    </div>
  );
}
