import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/ActionForm";
import { forgotAction } from "../actions";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="page-head"><h1>Reset your password</h1><p>Enter your email and we&apos;ll send you a reset link.</p></div>
        <ActionForm action={forgotAction} submitLabel="Send reset link">
          <Field name="email" label="Email" type="email" autoComplete="email" />
        </ActionForm>
      </div>
    </div>
  );
}
