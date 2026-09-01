import { ShieldCheck } from "lucide-react";

/**
 * Shown wherever a customer is about to pay for something escrow-protected
 * (a service booking or an event ticket) — sets the expectation up front
 * that their money isn't simply handed to the other side the moment they
 * pay.
 */
export function EscrowNotice({ subject = "payment" }: { subject?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-foreground/80">
        <span className="font-medium text-foreground">Your {subject} is protected.</span> We hold it securely in
        escrow and only release it once you confirm everything went as expected — never before.
      </p>
    </div>
  );
}
