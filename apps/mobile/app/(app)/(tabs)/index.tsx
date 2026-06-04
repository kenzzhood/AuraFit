import { useState, useCallback } from "react";
import { View, Text, Image, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/clerk-expo";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import { useStyleSession } from "../../../src/store/useStyleSession";
import { saveLocalImageFromUri } from "../../../src/storage/localFiles";
import { uploadImage, AuthRequiredError } from "../../../src/api/client";

/** JPEG quality 0–1 — lower keeps uploads fast on mobile networks. */
const UPLOAD_QUALITY = 0.72;

export default function StyleHomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { localPhotoUri, setLocalPhoto, setRemotePhotoUrl } = useStyleSession();
  const [busy, setBusy] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const reauth = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore — Clerk redirects to sign-in via the (app) layout guard anyway
    }
    router.replace("/(auth)/sign-in");
  }, [router, signOut]);

  const pickImage = useCallback(
    async (useCamera: boolean) => {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          useCamera
            ? "Allow camera access in Settings to take a photo."
            : "Allow Photos access in Settings to choose an image.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "OK" },
          ]
        );
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        quality: UPLOAD_QUALITY,
        allowsEditing: true,
        aspect: [3, 4],
        exif: false,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setLocalPhoto(asset.uri);
      setUploadFailed(false);
      setAuthFailed(false);
      setUploadError(null);
      setBusy(true);

      try {
        const fileName = `selfie-${Date.now()}.jpg`;

        // Copy to file:// so native upload can read it (Android content:// fails).
        const localUri = await saveLocalImageFromUri(
          "selfies",
          fileName,
          asset.uri
        );

        const up = await uploadImage({
          uri: localUri,
          fileName,
          contentType: "image/jpeg",
          kind: "profile",
        });
        setRemotePhotoUrl(up.url);
      } catch (e) {
        if (e instanceof AuthRequiredError) {
          setUploadError(e.message);
          setAuthFailed(true);
          setUploadFailed(true);
        } else {
          const msg =
            e instanceof Error
              ? e.message
              : "Could not upload photo. Please try again.";
          setUploadError(msg);
          setUploadFailed(true);
        }
      } finally {
        setBusy(false);
      }
    },
    [setLocalPhoto, setRemotePhotoUrl]
  );

  const retryUpload = useCallback(() => {
    pickImage(false);
  }, [pickImage]);

  return (
    <Screen className="py-6">
      <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
        Step 1
      </Text>
      <Text className="mt-3 font-display text-3xl text-cream">Your photo</Text>
      <Text className="mt-2 text-sm leading-6 text-dim">
        A clear selfie or full-body shot. Stored locally first — only sent for
        styling when you generate.
      </Text>

      <Pressable
        onPress={() => !busy && pickImage(false)}
        className="mt-8 flex-1 overflow-hidden rounded-3xl border border-dashed border-border bg-ink/60"
      >
        {localPhotoUri ? (
          <View className="relative flex-1">
            <Image
              source={{ uri: localPhotoUri }}
              className="h-full w-full"
              resizeMode="cover"
            />
            {busy && (
              <View className="absolute inset-0 items-center justify-center bg-black/50">
                <ActivityIndicator color="#d4b896" size="large" />
                <Text className="mt-3 text-xs text-champagne">Uploading…</Text>
              </View>
            )}
            {uploadFailed && !busy && (
              <View className="absolute inset-0 items-center justify-center bg-black/60 px-6">
                <Text className="text-center text-sm text-red-400">
                  {uploadError}
                </Text>
                <Pressable
                  onPress={authFailed ? reauth : retryUpload}
                  className="mt-4 rounded-xl border border-champagne/60 px-6 py-3"
                >
                  <Text className="text-sm text-champagne">
                    {authFailed ? "Sign in again" : "Retry"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-center text-sm text-muted">
              Tap to choose from gallery
            </Text>
          </View>
        )}
      </Pressable>

      <View className="mt-4 flex-row gap-3">
        <Button
          label="Camera"
          variant="ghost"
          className="flex-1"
          onPress={() => pickImage(true)}
          disabled={busy}
        />
        <Button
          label="Gallery"
          variant="ghost"
          className="flex-1"
          onPress={() => pickImage(false)}
          disabled={busy}
        />
      </View>

      <View className="mt-6 gap-3">
        <Button
          label={busy ? "Uploading…" : "Continue"}
          loading={busy}
          disabled={!localPhotoUri || busy || uploadFailed}
          onPress={() => router.push("/(app)/style")}
        />
        {uploadFailed && authFailed && (
          <Button label="Sign in again" onPress={reauth} />
        )}
        {uploadFailed && !authFailed && (
          <Button
            label="Choose different photo"
            variant="ghost"
            onPress={retryUpload}
          />
        )}
      </View>
    </Screen>
  );
}
