import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  type PressableProps,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { cn } from "../../lib/cn";

type Props = Omit<PressableProps, "children"> & {
  label?: string;
  loading?: boolean;
  className?: string;
};

export function GoogleButton({
  label = "Continue with Google",
  loading,
  className,
  ...props
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "flex-row items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4",
        "active:opacity-90",
        props.disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#070608" />
      ) : (
        <View className="flex-row items-center gap-3">
          <FontAwesome name="google" size={18} color="#4285F4" />
          <Text className="text-sm font-semibold text-void">{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
