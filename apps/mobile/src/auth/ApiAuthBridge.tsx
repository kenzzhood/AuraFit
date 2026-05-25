import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { setApiTokenGetter } from "@/api/client";

export function ApiAuthBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setApiTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
  }, [getToken, isSignedIn]);

  return null;
}
