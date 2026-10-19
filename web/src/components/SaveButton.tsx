"use client";
import { useSaved } from "./useSaved";
import { track } from "./track";

export function SaveButton({ slug, name, className = "save-btn" }: { slug: string; name: string; className?: string }) {
  const { has, toggle } = useSaved();
  const saved = has(slug);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name} for later`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!saved) track("save_item", { slug });
        toggle(slug);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.6-9.2C1 8.2 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.7 0 5.6 3.7 4.2 6.8-2.1 4.6-9.6 9.2-9.6 9.2z" />
      </svg>
    </button>
  );
}
