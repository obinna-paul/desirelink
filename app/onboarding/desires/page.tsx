import { redirect } from "next/navigation";

export default function DesireOnboardingRedirect() {
  redirect("/profile/edit#desire-map");
}
