import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { GOOGLE_ERRORS, GoogleButton } from "@/components/GoogleButton";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/account/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? GOOGLE_ERRORS[error] : undefined;
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="page-head"><h1>Sign in</h1><p>Track your orders and check out faster.</p></div>
        {message && <p className="notice error" role="alert">{message}</p>}
        <GoogleButton />
        <ActionForm action={loginAction} submitLabel="Sign in">
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password" type="password" autoComplete="current-password" />
        </ActionForm>
        <p className="muted" style={{ marginTop: 24 }}>
          <Link className="mini-link" href="/account/forgot">Forgot password?</Link> · New here? <Link className="mini-link" href="/account/register">Create an account</Link>
        </p>
        <p className="muted" style={{ fontSize: 13 }}>No account needed to shop — you can check out as a guest.</p>
      </div>
    </div>
  );
}
