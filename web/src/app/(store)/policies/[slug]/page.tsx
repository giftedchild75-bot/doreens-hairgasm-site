import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getSetting } from "@/server/seed";
import { whatsappLink } from "@/lib/env";

export const dynamic = "force-dynamic";

// Policy text is written by the owner in Admin → Settings; nothing here is invented.
const PAGES: Record<string, { title: string; key: string }> = {
  delivery: { title: "Delivery", key: "delivery_info" },
  returns: { title: "Returns & Refunds", key: "returns_policy" },
  privacy: { title: "Privacy", key: "privacy_policy" },
};

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const page = PAGES[(await params).slug];
  return page ? { title: page.title } : { title: "Not found" };
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  const text = await getSetting(await getDb(), page.key);
  return (
    <div className="page">
      <div className="container">
        <div className="page-head"><h1>{page.title}</h1></div>
        <div className="prose">
          {text ? (
            <p>{text}</p>
          ) : (
            <p className="notice">
              Our full {page.title.toLowerCase()} policy is being finalised. In the meantime, please{" "}
              <a className="mini-link" href={whatsappLink(`Hi Doreen! A question about ${page.title.toLowerCase()}.`)} target="_blank" rel="noopener">
                message us on WhatsApp
              </a>{" "}
              and we&apos;ll explain exactly what applies to your order before you buy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
