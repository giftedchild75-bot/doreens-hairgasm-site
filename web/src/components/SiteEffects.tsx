"use client";
/** Ports the original site's motion: scroll progress, nav compress, hero parallax/spotlight. (Reveals are CSS-only, see store.css.) */
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SiteEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = document.querySelector<HTMLElement>("header.nav");
    const hero = document.querySelector<HTMLElement>(".hero");
    const heroMedia = document.querySelector<HTMLElement>(".hero-media");
    const progress = document.getElementById("scroll-progress");
    let ticking = false;
    const frame = () => {
      const y = window.scrollY;
      nav?.classList.toggle("is-scrolled", y > 40);
      if (hero && heroMedia && !reduced && y < hero.offsetHeight) heroMedia.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(frame);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    frame();

    // Hero cursor spotlight — fine pointers only.
    const glow = document.getElementById("hero-glow");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const move = (e: MouseEvent) => {
      if (!hero || !glow) return;
      const r = hero.getBoundingClientRect();
      glow.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
      glow.classList.add("is-active");
    };
    const leave = () => glow?.classList.remove("is-active");
    if (!reduced && fine && hero) {
      hero.addEventListener("mousemove", move);
      hero.addEventListener("mouseleave", leave);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      hero?.removeEventListener("mousemove", move);
      hero?.removeEventListener("mouseleave", leave);
    };
  }, [pathname]);

  return null;
}
