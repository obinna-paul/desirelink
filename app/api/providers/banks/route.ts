import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { paymentProvider } from "@/lib/payments";

/** Bank list for the payout-setup dropdown. Not sensitive, but still auth-gated for consistency with the rest of the providers API surface. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const banks = await paymentProvider.getBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    console.error("[providers/banks] failed to load bank list", error);
    return NextResponse.json({ error: "Couldn't load the bank list. Try again shortly." }, { status: 502 });
  }
}
