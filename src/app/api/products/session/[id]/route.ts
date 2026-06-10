import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getProductSearchSessionForUser } from "@/lib/ecommerce/session";
import { productToNormalized } from "@/lib/ecommerce/product";
import { ensureAppUser } from "@/lib/user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const { id } = await params;
  const session = await getProductSearchSessionForUser(id, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    status: session.status,
    query: session.query,
    region: session.region,
    products: session.products.map((p) => productToNormalized(p)),
    providerMeta: session.providerMeta,
    generationJobId: session.generationJobId,
  });
}
