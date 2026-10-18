"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { track } from "./track";

/** Plain GET form (works without JS); with JS it applies filters instantly. */
export function FilterForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function apply(kind: "filter" | "search") {
    const form = ref.current!;
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string" && v.trim() !== "") params.set(k, v.trim());
    });
    params.delete("page");
    router.replace(`/shop?${params.toString()}`, { scroll: false });
    track(kind === "search" ? "search" : "filter", Object.fromEntries(params));
  }

  return (
    <form
      ref={ref}
      action="/shop"
      method="get"
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        clearTimeout(timer.current);
        if (t.type === "search" || t.type === "number") {
          timer.current = setTimeout(() => apply(t.type === "search" ? "search" : "filter"), 350);
        } else apply("filter");
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply("search");
      }}
    >
      <button
        type="button"
        className="btn btn-outline filters-toggle"
        aria-expanded={open}
        aria-controls="shop-filters"
        onClick={() => {
          setOpen((o) => !o);
          document.getElementById("shop-filters")?.classList.toggle("is-open");
        }}
        style={{ marginBottom: 16 }}
      >
        {open ? "Hide filters" : "Filters"}
      </button>
      {children}
    </form>
  );
}
