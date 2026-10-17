import { NextResponse } from "next/server";
import { processRazorpayWebhook } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const result = await processRazorpayWebhook(rawBody, signature);

  if (!result.ok && result.error === "Invalid webhook signature") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, duplicate: result.duplicate ?? false });
}
