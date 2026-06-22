import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { setApiTokenGetter } from "../api/client";
import { useCartStore } from "../store/useCartStore";

export function ApiAuthBridge() {
  const { getToken, isSignedIn } = useAuth();
  const mergeLocalCart = useCartStore((s) => s.mergeLocalCart);

  useEffect(() => {
    setApiTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      void mergeLocalCart();
    }
  }, [isSignedIn, mergeLocalCart]);

  return null;
}
