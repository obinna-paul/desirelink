"use client";

import { useState } from "react";

import { LegalModal } from "@/components/auth/legal-modal";
import { PRIVACY_POLICY, SAFETY_GUIDELINES, TERMS_OF_USE } from "@/lib/legal-content";

type OpenDocument = "terms" | "privacy" | "safety" | null;

export function LoginConsent({
  agreed,
  onAgreedChange,
}: {
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
}) {
  const [openDocument, setOpenDocument] = useState<OpenDocument>(null);

  return (
    <>
      <label className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-[#786a73]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => onAgreedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d8c8d2] text-[#8f285d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f285d]"
        />
        <span>
          I&apos;m at least 18 years old and I agree to udala&apos;s{" "}
          <button
            type="button"
            onClick={() => setOpenDocument("terms")}
            className="font-semibold text-[#8f285d] underline-offset-4 hover:underline"
          >
            Terms of Use
          </button>
          ,{" "}
          <button
            type="button"
            onClick={() => setOpenDocument("privacy")}
            className="font-semibold text-[#8f285d] underline-offset-4 hover:underline"
          >
            Privacy Policy
          </button>
          , and{" "}
          <button
            type="button"
            onClick={() => setOpenDocument("safety")}
            className="font-semibold text-[#8f285d] underline-offset-4 hover:underline"
          >
            Safety Guidelines
          </button>
          .
        </span>
      </label>

      {openDocument === "terms" && <LegalModal doc={TERMS_OF_USE} onClose={() => setOpenDocument(null)} />}
      {openDocument === "privacy" && <LegalModal doc={PRIVACY_POLICY} onClose={() => setOpenDocument(null)} />}
      {openDocument === "safety" && <LegalModal doc={SAFETY_GUIDELINES} onClose={() => setOpenDocument(null)} />}
    </>
  );
}
