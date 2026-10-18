import { CartProvider } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteEffects } from "@/components/SiteEffects";
import { WhatsAppIcon } from "@/components/Icons";
import { getDb } from "@/db/client";
import { getSetting } from "@/server/seed";
import { whatsappLink } from "@/lib/env";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const db = await getDb();
  const announcement = await getSetting(db, "announcement");
  const wa = whatsappLink("Hi Doreen! I'd love some help choosing a piece 💛");
  return (
    <CartProvider>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="scroll-progress" id="scroll-progress" />
      {announcement && <div className="announce">{announcement}</div>}
      <SiteHeader whatsappHref={wa} />
      <main id="main">{children}</main>
      <SiteFooter />
      <a className="float-wa" href={wa} target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
        <WhatsAppIcon />
      </a>
      <SiteEffects />
    </CartProvider>
  );
}
