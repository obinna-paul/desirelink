import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { addAccountNote } from "@/lib/admin/accounts";
import { readJson } from "@/lib/security/request";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "write_notes");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await readJson(req)) as { body?: unknown } | null;
  const noteBody = typeof body?.body === "string" ? body.body : "";

  const result = await addAccountNote(params.id, session!.user.id, noteBody);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, noteId: result.noteId }, { status: 201 });
}
