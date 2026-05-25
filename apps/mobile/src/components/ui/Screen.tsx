import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";

export function Screen({
  className,
  children,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-void" edges={["top", "bottom"]}>
      <View className={cn("flex-1 px-5", className)} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
