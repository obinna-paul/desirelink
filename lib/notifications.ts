import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type NotificationKind = "message" | "like" | "comment" | "reply" | "rsvp" | "subscription" | "review" | "booking" | "live";

function isMissingNotificationSchema(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes("Notification")
  );
}

export async function createNotification({
  recipientId,
  actorId,
  type,
  title,
  body,
  href,
}: {
  recipientId: string;
  actorId?: string;
  type: NotificationKind;
  title: string;
  body: string;
  href: string;
}) {
  if (recipientId === actorId) return null;

  try {
    return await prisma.notification.create({
      data: { recipientId, actorId, type, title, body, href },
    });
  } catch (error) {
    if (!isMissingNotificationSchema(error)) throw error;
    console.warn("Notifications are unavailable until the Notification migration is applied.");
    return null;
  }
}

export async function createNotificationsBulk(
  notifications: Array<{
    recipientId: string;
    actorId?: string;
    type: NotificationKind;
    title: string;
    body: string;
    href: string;
  }>,
) {
  const rows = notifications.filter((n) => n.recipientId !== n.actorId);
  if (rows.length === 0) return;

  try {
    await prisma.notification.createMany({ data: rows });
  } catch (error) {
    if (!isMissingNotificationSchema(error)) throw error;
    console.warn("Notifications are unavailable until the Notification migration is applied.");
  }
}

export async function getNotifications(recipientId: string) {
  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          actor: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.notification.count({ where: { recipientId, readAt: null } }),
    ]);
    return { items, unreadCount };
  } catch (error) {
    if (!isMissingNotificationSchema(error)) throw error;
    return { items: [], unreadCount: 0 };
  }
}

export async function markNotificationsRead(recipientId: string, id?: string) {
  try {
    await prisma.notification.updateMany({
      where: { recipientId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
  } catch (error) {
    if (!isMissingNotificationSchema(error)) throw error;
  }
}
