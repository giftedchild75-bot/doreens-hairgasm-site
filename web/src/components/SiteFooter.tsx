import Link from "next/link";
import { brand } from "@/lib/env";
import { Crown } from "./Icons";

export function SiteFooter() {
  return (
    <footer>
      <div className="container">
        <Link className="logo" href="/">
          <Crown className="logo-crown" />
          <span className="logo-text"><span className="logo-name">Doreen&apos;s</span><span className="logo-script">Hairgasm</span></span>
        </Link>
        <p className="foot-tagline">Your Hair, Your Crown</p>
        <nav className="foot-links" aria-label="Footer">
          <Link href="/shop">Shop</Link>
          <Link href="/guide">Wig Guide</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/policies/delivery">Delivery</Link>
          <Link href="/policies/returns">Returns</Link>
          <Link href="/policies/privacy">Privacy</Link>
          <Link href="/orders/lookup">Track an order</Link>
          <a href={brand.instagramUrl} target="_blank" rel="noopener">Instagram</a>
          <a href={brand.tiktokUrl} target="_blank" rel="noopener">TikTok</a>
        </nav>
        <p className="fine">© {new Date().getFullYear()} {brand.name} · {brand.location} · Since 2021. All rights reserved.</p>
      </div>
    </footer>
  );
}
