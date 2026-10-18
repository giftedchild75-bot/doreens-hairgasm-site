import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../admin.css";
import { currentAdmin } from "@/server/auth";
import { ActionForm, Field } from "@/components/ActionForm";
import { adminLoginAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default async function AdminLogin() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--blush)", padding: 16 }}>
      <div className="panel" style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, marginTop: 0 }}>Staff sign in</h1>
        <ActionForm action={adminLoginAction} submitLabel="Sign in">
          <Field name="email" label="Email" type="email" autoComplete="username" />
          <Field name="password" label="Password" type="password" autoComplete="current-password" />
        </ActionForm>
      </div>
    </div>
  );
}
