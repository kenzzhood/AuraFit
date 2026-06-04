import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Screen } from "../../src/components/ui/Screen";
import { ChatRequestError, sendChatMessage } from "../../src/api/client";

const SUGGESTIONS = [
  "Make this more minimal",
  "Add luxury accessories",
  "Make it cheaper",
  "Make it more Korean fashion",
  "Use my wardrobe items",
];

function stylistErrorMessage(err: unknown): string {
  if (err instanceof ChatRequestError) {
    if (err.status === 401 || err.status === 403) {
      return "Please sign in again to use the stylist.";
    }
    if (err.status === 503) {
      return "Stylist is temporarily unavailable. The AI service may not be configured on the server.";
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (err.message.includes("timed out")) {
      return "Stylist request timed out. Please try again.";
    }
    if (err.message.includes("Could not reach stylist")) {
      return err.message;
    }
    return err.message;
  }
  return "Could not reach the stylist. Please try again.";
}

export default function RefineScreen() {
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");

    try {
      const { response: res, conversationId: newConvId } = await sendChatMessage({
        message: text,
        conversationId,
      });
      if (newConvId) setConversationId(newConvId);

      let assistant = "";
      const reader = res.body?.getReader();

      if (reader) {
        const decoder = new TextDecoder();
        setMessages((m) => [...m, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistant += decoder.decode(value, { stream: true });
          const snapshot = assistant;
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { role: "assistant", content: snapshot };
            } else {
              copy.push({ role: "assistant", content: snapshot });
            }
            return copy;
          });
        }

        if (!assistant.trim()) {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                role: "assistant",
                content: "I couldn't generate a reply. Please try again.",
              };
            }
            return copy;
          });
        }
      } else {
        const textBody = await res.text();
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: textBody.trim() || "No response.",
          },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: stylistErrorMessage(err) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="py-4">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Text className="font-display text-2xl text-cream">Refine</Text>
        <Text className="mt-1 text-sm text-dim">
          Concise stylist — after you picked a look.
        </Text>

        <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
          {messages.map((m, i) => (
            <View
              key={i}
              className={`mb-3 max-w-[90%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "ml-auto bg-champagne/20"
                  : "bg-ink border border-border"
              }`}
            >
              <Text className="text-sm leading-5 text-cream">{m.content}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => send(s)}
              disabled={busy}
              className="mr-2 rounded-full border border-border px-3 py-2"
            >
              <Text className="text-xs text-dim">{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="flex-row gap-2 pb-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask your stylist…"
            placeholderTextColor="#6b6b73"
            editable={!busy}
            className="flex-1 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
          />
          <Pressable
            onPress={() => send(input)}
            disabled={busy}
            className="items-center justify-center rounded-2xl bg-champagne px-5 opacity-100 disabled:opacity-50"
          >
            <Text className="font-semibold text-void">{busy ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
