import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminAuditAction =
  | "verification.approve"
  | "verification.deny"
  | "verification.view_media"
  | "moderation.review"
  | "moderation.remove"
  | "moderation.warn"
  | "moderation.suspend"
  /** @deprecated superseded by mark_paid/mark_failed once withdrawals became a manual
   * bank transfer instead of an automated Paystack payout - kept so historical rows still
   * display correctly. */
  | "withdrawal.approve"
  | "withdrawal.mark_paid"
  | "withdrawal.mark_failed"
  | "content.view_locked"
  | "account.suspend"
  | "account.reinstate"
  | "account.note"
  | "finance.release_escrow"
  | "finance.refund_escrow"
  | "admin.role_change"
  | "support.resolve";

/**
 * Writes one append-only audit row. Called for both privileged WRITES (approving a
 * withdrawal) and sensitive READS (opening a verification document or paywalled post) -
 * an admin console that only logs writes can't answer "who looked at this," which is the
 * more sensitive question for identity documents and private content.
 *
 * Deliberately never throws: an audit-log failure must never block or silently corrupt the
 * underlying admin action it's describing. A logging failure is itself logged to the
 * server console so it isn't invisible, but the caller's transaction already committed.
 */
export async function recordAdminAction(params: {
  actorId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        summary: params.summary,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("[admin audit] failed to record action", params.action, error);
  }
}

const auditActorSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export type AuditLogFilters = {
  actorId?: string;
  targetType?: string;
  action?: AdminAuditAction;
  cursor?: string;
  take?: number;
};

export async function getAuditLog(filters: AuditLogFilters = {}) {
  const take = Math.min(filters.take ?? 50, 200);

  const rows = await prisma.adminAuditLog.findMany({
    where: {
      actorId: filters.actorId,
      targetType: filters.targetType,
      action: filters.action,
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { actor: { select: auditActorSelect } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
