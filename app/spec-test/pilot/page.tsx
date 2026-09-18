import { redirect } from "next/navigation";

/** The research pilot has graduated into the official Spec Test. Keep old shared links useful
 * without exposing a second, competing test. Historical pilot data remains untouched. */
export default function RetiredSpecTestPilotPage() {
  redirect("/spec-test/quiz");
}
