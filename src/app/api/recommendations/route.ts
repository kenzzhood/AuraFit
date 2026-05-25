import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import { recommendOutfitNarrative } from "@/lib/ai/stylist";
import { z } from "zod";

const schema = z.object({
  occasion: z.string().optional(),
  location: z.string().optional(),
  budget: z.string().optional(),
  style: z.string().optional(),
  wardrobeSummary: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const text = await recommendOutfitNarrative(parsed.data);
    return NextResponse.json({ text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 503 });
  }
}
