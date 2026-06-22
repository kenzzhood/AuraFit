import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  Linking,
  Alert,
} from "react-native";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import { useCartStore } from "../../../src/store/useCartStore";
import { getCheckout, trackAffiliateClick } from "../../../src/api/client";

const COLORS = {
  champagne: "#d4b896",
  muted: "#6b6b73",
  border: "rgba(255,255,255,0.08)",
};

function formatMoney(amount: number, currency: string) {
  const sym = currency === "INR" || !currency ? "₹" : "$";
  return `${sym}${amount.toLocaleString("en-IN")}`;
}

type ViewMode = "outfit" | "retailer";

export default function CartScreen() {
  const items = useCartStore((s) => s.items);
  const count = useCartStore((s) => s.count);
  const subtotal = useCartStore((s) => s.subtotal);
  const currency = useCartStore((s) => s.currency);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const [view, setView] = useState<ViewMode>("outfit");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const byOutfit = useMemo(() => {
    const map = new Map<
      string,
      { outfitId: string | null; outfitLabel: string | null; items: typeof items }
    >();
    for (const item of items) {
      const key = item.outfitId ?? "__ungrouped__";
      const group = map.get(key);
      if (group) {
        group.items.push(item);
      } else {
        map.set(key, {
          outfitId: item.outfitId ?? null,
          outfitLabel: item.outfitLabel ?? null,
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const byRetailer = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.retailer ?? "Other";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleCheckout = useCallback(async () => {
    if (count === 0) return;
    setCheckingOut(true);
    try {
      const checkout = await getCheckout();
      if (checkout.groups.length === 0) {
        Alert.alert("Cart empty", "Add items before checkout.");
        return;
      }
      Alert.alert(
        "Open retailer links",
        `We'll open ${checkout.groups.length} retailer tab${checkout.groups.length === 1 ? "" : "s"} in your browser.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              for (const group of checkout.groups) {
                for (const item of group.items) {
                  try {
                    const { redirectUrl } = await trackAffiliateClick({
                      targetUrl: item.productUrl,
                      source: "cart_checkout",
                      outfitId: item.outfitId ?? undefined,
                      productCacheId: item.productCacheId ?? undefined,
                    });
                    await Linking.openURL(redirectUrl);
                  } catch {
                    await Linking.openURL(item.effectiveUrl);
                  }
                }
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        "Checkout failed",
        e instanceof Error ? e.message : "Could not start checkout."
      );
    } finally {
      setCheckingOut(false);
    }
  }, [count]);

  const renderItem = (item: (typeof items)[number]) => (
    <View
      key={item.id}
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 8,
      }}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: 56, height: 56, borderRadius: 10 }}
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#f5f0ea", fontSize: 14 }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.retailer ? (
          <Text
            style={{
              color: COLORS.muted,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {item.retailer}
          </Text>
        ) : null}
        {item.price != null ? (
          <Text style={{ color: COLORS.champagne, fontSize: 12, marginTop: 4 }}>
            {formatMoney(item.price, item.currency)}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={() => void removeItem(item.id)}>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>Remove</Text>
      </Pressable>
    </View>
  );

  const listData =
    view === "outfit"
      ? byOutfit.flatMap((g) => [
          { type: "header" as const, key: `h-${g.outfitId ?? g.outfitLabel}`, label: g.outfitLabel ?? "Individual items" },
          ...g.items.map((item) => ({ type: "item" as const, key: item.id, item })),
        ])
      : byRetailer.flatMap(([retailer, groupItems]) => [
          { type: "header" as const, key: `h-${retailer}`, label: retailer },
          ...groupItems.map((item) => ({ type: "item" as const, key: item.id, item })),
        ]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 4, paddingBottom: 24 }}>
        <Text
          style={{
            color: COLORS.muted,
            fontSize: 10,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Atelier
        </Text>
        <Text
          style={{
            color: "#f5f0ea",
            fontSize: 28,
            fontWeight: "600",
            marginTop: 8,
          }}
        >
          Your cart
        </Text>
        <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 6 }}>
          {count} item{count === 1 ? "" : "s"}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 16 }}>
          {(["outfit", "retailer"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setView(mode)}
              style={{
                borderWidth: 1,
                borderColor: view === mode ? "rgba(212,184,150,0.5)" : COLORS.border,
                backgroundColor:
                  view === mode ? "rgba(212,184,150,0.1)" : "transparent",
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: view === mode ? COLORS.champagne : COLORS.muted,
                  fontSize: 11,
                  textTransform: "capitalize",
                }}
              >
                By {mode}
              </Text>
            </Pressable>
          ))}
        </View>

        {count === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: COLORS.border,
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.muted, textAlign: "center" }}>
              Nothing here yet — add pieces from your generated looks.
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(row) => row.key}
            scrollEnabled={false}
            renderItem={({ item: row }) =>
              row.type === "header" ? (
                <Text
                  style={{
                    color: COLORS.muted,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 8,
                    marginTop: 12,
                  }}
                >
                  {row.label}
                </Text>
              ) : (
                renderItem(row.item)
              )
            }
          />
        )}

        {count > 0 && (
          <View style={{ marginTop: 24, gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.muted }}>Estimated total</Text>
              <Text style={{ color: COLORS.champagne, fontSize: 18, fontWeight: "600" }}>
                {formatMoney(subtotal, currency)}
              </Text>
            </View>
            <Button
              label={checkingOut ? "Preparing…" : "Checkout"}
              onPress={() => void handleCheckout()}
              disabled={checkingOut}
            />
            <Pressable onPress={() => void clearCart()}>
              <Text
                style={{
                  color: COLORS.muted,
                  textAlign: "center",
                  fontSize: 12,
                  textDecorationLine: "underline",
                }}
              >
                Clear cart
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}
