import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/ActionForm";
import { lookupAction } from "../../account/actions";

export const metadata: Metadata = { title: "Find your order", robots: { index: false } };

export default function LookupPage() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="page-head">
          <h1>Find your order</h1>
          <p>Enter your order reference (for example DH-7K3Q9PXA) and the email you used. We&apos;ll email you a secure link to it.</p>
        </div>
        <ActionForm action={lookupAction} submitLabel="Email me a link">
          <Field name="reference" label="Order reference" autoComplete="off" />
          <Field name="email" label="Email" type="email" autoComplete="email" />
        </ActionForm>
      </div>
    </div>
  );
}
