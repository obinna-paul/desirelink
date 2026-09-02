"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useFocusTrap } from "@/lib/use-focus-trap";
import type { LegalDocument } from "@/lib/legal-content";

export function LegalModal({ doc, onClose }: { doc: LegalDocument; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white text-[#1b141b] shadow-2xl focus:outline-none sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#efe4ea] px-5 pb-4 pt-5">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-[#171017]">{doc.title}</h2>
            <p className="mt-0.5 text-xs text-[#8a7b85]">Last updated {doc.lastUpdated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${doc.title}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6f626b] transition-colors hover:bg-[#f3e9ee] hover:text-[#1b141b]"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-[#3a323a]">{doc.intro}</p>

          <div className="mt-5 flex flex-col gap-5">
            {doc.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="text-sm font-semibold text-[#171017]">{section.heading}</h3>
                {section.paragraphs?.map((paragraph, index) => (
                  <p key={index} className="mt-1.5 text-sm leading-6 text-[#3a323a]">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {section.bullets.map((bullet, index) => (
                      <li key={index} className="flex gap-2 text-sm leading-6 text-[#3a323a]">
                        <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#8f285d]/60" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#efe4ea] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#050505] text-sm font-semibold text-white transition-colors hover:bg-[#1b1b1b] sm:w-auto sm:px-6"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
