import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/api/require-user";
import { prisma } from "@/lib/prisma";
import { mapConversationListItem } from "@/lib/chat/conversations";

export async function GET() {
  const authz = await requireAppUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const rows = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return NextResponse.json({
    conversations: rows.map(mapConversationListItem),
  });
}
