import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { ContactSupportForm } from "@/components/help/contact-support-form";

export const metadata: Metadata = {
  title: "Contact us — udala",
  description: "Send the Udala team a message — we reply within 24 hours, usually much sooner.",
};

export default async function ContactSupportPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Contact us</h1>
          <p className="text-muted-foreground">
            Tell us what&apos;s going on. A real person on our team will reply within 24 hours — usually much sooner.
          </p>
        </div>

        <ContactSupportForm defaultEmail={session?.user?.email ?? ""} />
      </main>

      <PublicFooter />
    </div>
  );
}
