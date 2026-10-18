import type { Metadata } from "next";
import Link from "next/link";
import "../admin.css";
import { requireAdmin } from "@/server/auth";
import { adminLogoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/customers", "Customers"],
  ["/admin/coupons", "Discounts"],
  ["/admin/shipping", "Delivery"],
  ["/admin/settings", "Store settings"],
  ["/admin/audit", "Audit log"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await requireAdmin();
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="brand">Doreen&apos;s Hairgasm · Admin</div>
        {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        <Link href="/" target="_blank">View store ↗</Link>
        <div className="who">{a.name} · {a.role}</div>
        <form action={adminLogoutAction}><button>Sign out</button></form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
