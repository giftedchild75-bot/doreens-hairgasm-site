import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/CheckoutForm";
import { currentCustomer } from "@/server/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  if (env.paymentsMode === "disabled") redirect("/cart");
  const coupon = (await searchParams).coupon;
  const customer = await currentCustomer();
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Checkout</h1>
          {env.paymentsMode === "test" && (
            <p className="notice" style={{ marginTop: 16 }}>Test mode — payments use Paystack&apos;s sandbox. No real money is charged.</p>
          )}
        </div>
        <CheckoutForm
          prefill={{ email: customer?.email, name: customer?.name ?? undefined, phone: customer?.phone ?? undefined }}
          initialCoupon={typeof coupon === "string" && coupon ? coupon : null}
        />
      </div>
    </div>
  );
}
