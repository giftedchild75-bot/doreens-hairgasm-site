"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBag } from "./CartProvider";
import { BagIcon, Crown, HeartIcon, SearchIcon, UserIcon } from "./Icons";
import { useSaved } from "./useSaved";

const LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?category=wigs", label: "Wigs" },
  { href: "/guide", label: "Wig Guide" },
  { href: "/shop?category=services", label: "Services" },
  { href: "/#shade-finder", label: "Find Your Shade" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ whatsappHref }: { whatsappHref: string }) {
  const { count, ready } = useBag();
  const saved = useSaved().slugs.length;
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const lastCount = useRef<number | null>(null);

  // A little celebration on the bag icon whenever something new goes in.
  useEffect(() => {
    if (!ready) return;
    if (lastCount.current !== null && count > lastCount.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 650);
      lastCount.current = count;
      return () => clearTimeout(t);
    }
    lastCount.current = count;
  }, [count, ready]);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="logo" href="/" aria-label="Doreen's Hairgasm — home">
            <Crown className="logo-crown" />
            <span className="logo-text"><span className="logo-name">Doreen&apos;s</span><span className="logo-script">Hairgasm</span></span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            {LINKS.slice(0, 4).map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </nav>
          <div className="nav-icons">
            <Link className="nav-icon hide-sm" href="/shop" aria-label="Search the collection"><SearchIcon /></Link>
            <Link className="nav-icon hide-sm" href="/account" aria-label="Your account"><UserIcon /></Link>
            <Link className="nav-icon" href="/saved" aria-label={`Saved pieces, ${saved}`}>
              <HeartIcon />
              {saved > 0 && <span className="saved-count">{saved}</span>}
            </Link>
            <Link className={`nav-icon${pop ? " bag-pop" : ""}`} href="/cart" aria-label={`Shopping bag, ${ready ? count : 0} items`}>
              <BagIcon />
              {ready && count > 0 && <span className="bag-count">{count}</span>}
            </Link>
            <button
              className="nav-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>
      <div className={`mobile-menu${open ? " is-open" : ""}`} id="mobile-menu" hidden={!open}>
        <nav className="mobile-menu-links" aria-label="Mobile">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href="/account">Account</Link>
          <Link href="/saved">Saved{saved > 0 ? ` (${saved})` : ""}</Link>
          <Link href="/cart">Bag{ready && count > 0 ? ` (${count})` : ""}</Link>
        </nav>
        <a className="btn btn-primary mobile-menu-cta" href={whatsappHref} target="_blank" rel="noopener">Chat on WhatsApp</a>
      </div>
      <div className={`mobile-menu-backdrop${open ? " is-open" : ""}`} hidden={!open} onClick={() => setOpen(false)} />
    </>
  );
}
