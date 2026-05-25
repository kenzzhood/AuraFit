import {
  Pressable,
  Text,
  type PressableProps,
  ActivityIndicator,
} from "react-native";
import { cn } from "@/lib/cn";

export function Button({
  label,
  variant = "primary",
  loading,
  className,
  ...props
}: PressableProps & {
  label: string;
  variant?: "primary" | "ghost";
  loading?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      className={cn(
        "items-center justify-center rounded-2xl px-6 py-4",
        variant === "primary" ? "bg-champagne" : "border border-border",
        props.disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#0f0e0c" : "#c9a962"} />
      ) : (
        <Text
          className={cn(
            "text-sm font-semibold",
            variant === "primary" ? "text-void" : "text-cream"
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
