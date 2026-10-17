import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import { getEntitlementSnapshot } from "@/lib/billing/entitlements";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );
  const snapshot = await getEntitlementSnapshot(user.id);
  return NextResponse.json(snapshot);
}
