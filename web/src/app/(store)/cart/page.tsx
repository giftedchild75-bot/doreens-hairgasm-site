import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head"><h1>Your Bag</h1></div>
        <CartView paymentsEnabled={env.paymentsMode !== "disabled"} whatsappNumber={env.whatsappNumber} />
      </div>
    </div>
  );
}
