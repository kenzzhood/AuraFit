import { ChatInterface } from "@/components/chat/ChatInterface";

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Stylist
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Chat with Aurafit
      </h1>
      <p className="mt-3 max-w-lg text-sm text-aura-dim">
        Streaming tokens append live as the assistant replies.
      </p>
      <div className="mt-10">
        <ChatInterface />
      </div>
    </div>
  );
}
