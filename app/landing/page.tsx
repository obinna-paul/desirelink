import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Udala - Log in",
  description:
    "Log in to udala, a premium African social discovery app for private chats, creator circles, events, and real-time availability.",
};

export default function LandingPage() {
  return (
    <AuthShell
      title="Log in to udala"
      description="Continue to your private social space, messages, events, and creator circles."
    >
      <LoginForm />
    </AuthShell>
  );
}
