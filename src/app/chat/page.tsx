import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";

function ChatPageBody() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Stylist
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Chat with Aurafit
      </h1>
      <p className="mt-3 max-w-lg text-sm text-aura-dim">
        Attach a photo and get shoppable looks in this thread — search, swap a
        piece, or match a garment. Generating a board uses a look credit.
      </p>
      <div className="mt-10">
        <ChatInterface />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-aura-muted">Loading…</p>
      }
    >
      <ChatPageBody />
    </Suspense>
  );
}
