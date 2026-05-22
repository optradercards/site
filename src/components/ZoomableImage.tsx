"use client";

import { useEffect, useState } from "react";

// Drop-in replacement for <img>. Renders the same thumbnail, adds a
// cursor-zoom-in cue, and opens a centered lightbox modal on click. Backdrop
// click and ESC close it. Stops propagation on the enlarged image so clicks
// on the image itself don't close.
//
// Use across /manage tables so traders can inspect card art at full size
// without leaving the page.
export default function ZoomableImage({
  src,
  alt,
  className,
  modalAlt,
}: {
  src: string;
  alt?: string;
  className?: string;
  modalAlt?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt={alt ?? ""}
        className={`${className ?? ""} cursor-zoom-in`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={modalAlt ?? alt ?? "Image preview"}
        >
          <img
            src={src}
            alt={modalAlt ?? alt ?? ""}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
