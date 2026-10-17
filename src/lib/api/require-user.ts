import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { DeletedUserError, ensureAppUser } from "@/lib/user";

export async function requireAppUser(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  try {
    const cu = await currentUser();
    const user = await ensureAppUser(
      userId,
      cu?.primaryEmailAddress?.emailAddress
    );
    return { ok: true, user };
  } catch (e) {
    if (e instanceof DeletedUserError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Account has been deleted" },
          { status: 403 }
        ),
      };
    }
    throw e;
  }
}
