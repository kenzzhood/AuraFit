import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";

const COLORS = {
  bg: "#070608",
  border: "rgba(255,255,255,0.08)",
  champagne: "#d4b896",
  muted: "#6b6b73",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.champagne,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 86 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Style",
          tabBarIcon: ({ color, size }) => (
            <Feather name="zap" color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bookmark" color={color} size={size - 2} />
          ),
        }}
      />
    </Tabs>
  );
}
