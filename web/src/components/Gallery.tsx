"use client";
import Image from "next/image";
import { useState } from "react";

export function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 30%");
  const img = images[i];
  if (!img) return <div className="gallery-main" aria-label={`${name} — photo coming soon`} />;
  return (
    <div>
      <button
        type="button"
        className={`gallery-main${zoom ? " is-zoomed" : ""}`}
        style={{ display: "block", width: "100%", border: 0, padding: 0 }}
        aria-label={zoom ? "Zoom out" : "Zoom in"}
        aria-pressed={zoom}
        onClick={() => setZoom((z) => !z)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        <Image src={img.url} alt={img.alt} fill priority sizes="(max-width: 920px) 100vw, 600px" style={{ transformOrigin: origin }} />
      </button>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((m, idx) => (
            <button key={m.url} type="button" aria-pressed={idx === i} aria-label={`Show photo ${idx + 1}`} onClick={() => { setI(idx); setZoom(false); }}>
              <Image src={m.url} alt="" width={72} height={96} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
