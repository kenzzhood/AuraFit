import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAppUser } from "@/lib/user";
import { createHdRenderJob } from "@/lib/jobs/hd-render";
import { withCors, optionsResponse } from "@/lib/api/cors";

const schema = z.object({
  jobId: z.string(),
  lookIndex: z.number().int().min(0).max(5).optional(),
  userPhotoUrl: z.string().url().optional(),
});

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { userId } = await auth();
  if (!userId) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      origin
    );
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  try {
    const hdJobId = await createHdRenderJob({
      userId: user.id,
      parentJobId: parsed.data.jobId,
      lookIndex: parsed.data.lookIndex,
    });
    return withCors(NextResponse.json({ jobId: hdJobId }), origin);
  } catch (e) {
    return withCors(
      NextResponse.json(
        { error: e instanceof Error ? e.message : "HD render failed" },
        { status: 500 }
      ),
      origin
    );
  }
}
