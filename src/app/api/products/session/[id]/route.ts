import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getProductSearchSession } from "@/lib/ecommerce/session";
import { productToNormalized } from "@/lib/ecommerce/product";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const session = await getProductSearchSession(id);
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
