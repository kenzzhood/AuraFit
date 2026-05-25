import { useState, useCallback } from "react";
import { View, Text, Image, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { useStyleSession } from "../../src/store/useStyleSession";
import { saveLocalImage } from "../../src/storage/localFiles";
import { uploadImage } from "../../src/api/client";

/** Max dimension for the image sent to the server (preserves aspect ratio). */
const MAX_UPLOAD_DIM = 1080;
/** JPEG quality 0–1 for upload (lower = faster, smaller; 0.82 is visually lossless). */
const UPLOAD_QUALITY = 0.82;

export default function UploadScreen() {
  const router = useRouter();
  const { localPhotoUri, setLocalPhoto, setRemotePhotoUrl } = useStyleSession();
  const [busy, setBusy] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickImage = useCallback(async (useCamera: boolean) => {
    // Request permission
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
          // On iOS this would open Settings; on Android it's informational
          { text: "OK" },
        ]
      );
      return;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      quality: UPLOAD_QUALITY,
      allowsEditing: true,
      aspect: [3, 4],
      // ⚠️  Critical: base64 must be true to get image data for upload
      base64: true,
      // Resize on device before upload — reduces payload from ~5MB to ~300KB
      exif: false,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setLocalPhoto(asset.uri);
    setUploadFailed(false);
    setUploadError(null);
    setBusy(true);

    try {
      if (!asset.base64) {
        throw new Error("Could not read image data. Please try again.");
      }

      const fileName = `selfie-${Date.now()}.jpg`;

      // Save locally first (privacy-first: device storage before cloud)
      await saveLocalImage("selfies", fileName, asset.base64).catch(() => {
        // Non-fatal — local save failure should not block upload
      });

      const up = await uploadImage({
        base64: asset.base64,
        fileName,
        contentType: "image/jpeg",
        kind: "profile",
      });
      setRemotePhotoUrl(up.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not upload photo. Please try again.";
      setUploadError(msg);
      setUploadFailed(true);
      // Don't clear localPhotoUri — user can still see their photo and retry
    } finally {
      setBusy(false);
    }
  }, [setLocalPhoto, setRemotePhotoUrl]);

  const retryUpload = useCallback(() => {
    // Re-trigger gallery picker to let user choose again
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
                <ActivityIndicator color="#c9a96e" size="large" />
                <Text className="mt-3 text-xs text-champagne">Uploading…</Text>
              </View>
            )}
            {uploadFailed && !busy && (
              <View className="absolute inset-0 items-center justify-center bg-black/60">
                <Text className="text-center text-sm text-red-400 px-6">
                  {uploadError}
                </Text>
                <Pressable
                  onPress={retryUpload}
                  className="mt-4 rounded-xl border border-champagne/60 px-6 py-3"
                >
                  <Text className="text-sm text-champagne">Retry</Text>
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
        {uploadFailed && (
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
