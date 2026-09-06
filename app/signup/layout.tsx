import type { Metadata } from "next";

import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create your private Udala account. You must be at least 18 years old to join.",
  robots: PRIVATE_ROBOTS,
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
