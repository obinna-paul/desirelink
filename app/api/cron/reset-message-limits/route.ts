import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { MESSAGE_LIMIT_METRIC_TYPE, messageLimitWindowStart } from "@/lib/messaging/limits";

export async function GET(req: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await prisma.engagementMetric.deleteMany({
    where: {
      metricType: MESSAGE_LIMIT_METRIC_TYPE,
      createdAt: { lt: messageLimitWindowStart() },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      resetAt: new Date().toISOString(),
      deletedExpiredUsageRows: result.count,
    },
    { status: 200 }
  );
}
