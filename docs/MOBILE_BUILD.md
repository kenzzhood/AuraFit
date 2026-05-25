# Aurafit Mobile — Build & Distribution Guide

## Overview

Aurafit mobile is built with Expo (React Native). Distribution is handled via **EAS (Expo Application Services)** — Expo's cloud build infrastructure that compiles native Android APKs/AABs and iOS IPAs without needing a local Android Studio or Xcode setup.

---

## Prerequisites

```bash
# Install EAS CLI (already installed globally)
npm install -g eas-cli

# Log in to your Expo account (free at expo.dev)
eas login
```

---

## Step 1: Create Your Expo Account & Link Project

```bash
cd apps/mobile

# Create a new EAS project (run once)
eas init

# This will:
# 1. Ask you to log in at expo.dev
# 2. Create a project called "aurafit"
# 3. Update app.json with the real projectId
# 4. Create an eas.json if it doesn't exist
```

After `eas init`, update `app.json`:
- Replace `REPLACE_WITH_EAS_PROJECT_ID` with the real project ID

---

## Step 2: Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then edit `apps/mobile/.env`:
```bash
# Find your local IP
ipconfig getifaddr en0   # macOS

# Set it
EXPO_PUBLIC_API_URL=http://192.168.1.X:3000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

For EAS builds, set secrets in the cloud (never in eas.json):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.aurafit.app
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
```

---

## Step 3: Build Profiles

### Development Build (for testing with Expo Go replacement)
```bash
cd apps/mobile
eas build --platform android --profile development
# or iOS:
eas build --platform ios --profile development --simulator
```

### Preview APK (sideload on Android — no Play Store needed)
```bash
cd apps/mobile
eas build --platform android --profile preview
```
This produces a **direct-install APK** you can:
- Download from EAS dashboard
- Share via link for beta testing
- Install with `adb install` or by opening the URL on your phone

### Production App Bundle (Play Store)
```bash
cd apps/mobile
eas build --platform android --profile production
```
Produces a **signed AAB** ready for Play Store upload.

### Production IPA (App Store)
```bash
cd apps/mobile
eas build --platform ios --profile production
```
Produces a **signed IPA** for App Store submission.

---

## Step 4: Submit to Stores

### Google Play Store
```bash
# First time: get a service account key from Google Play Console
# Save it as apps/mobile/google-play-key.json (gitignored)

eas submit --platform android --profile production
```

### Apple App Store
```bash
# Requires Apple Developer account ($99/year)
eas submit --platform ios --profile production
```

---

## Step 5: Over-the-Air Updates (OTA)

After the app is installed, you can push JS-only updates (no new store review needed) via EAS Update:

```bash
# Preview channel
eas update --channel preview --message "Fix: upload base64 bug"

# Production channel
eas update --channel production --message "Hotfix: generation timeout"
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Dev build (Android) | `eas build -p android --profile development` |
| Preview APK | `eas build -p android --profile preview` |
| Production AAB | `eas build -p android --profile production` |
| Production IPA | `eas build -p ios --profile production` |
| Push OTA update | `eas update --channel production` |
| View builds | `eas build:list` |
| Submit to Play Store | `eas submit -p android --profile production` |
| Submit to App Store | `eas submit -p ios --profile production` |

---

## Build Versions

- **Android**: increment `versionCode` in `app.json` → `android.versionCode` for every Play Store submission
- **iOS**: increment `buildNumber` in `app.json` → `ios.buildNumber` for every App Store submission
- **Both**: increment `version` (semver) for user-visible releases

> [!TIP]
> Set `"autoIncrement": true` in `eas.json` production profile (already done) to let EAS auto-bump `versionCode`/`buildNumber`.

---

## Troubleshooting

**Build fails with "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY not set":**
```bash
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
```

**Android APK won't install:**
- Enable "Install from unknown sources" in Android Settings → Security
- Or use the preview profile which creates a directly installable APK

**iOS build fails:**
- You need an Apple Developer account ($99/year at developer.apple.com)
- EAS handles provisioning profiles automatically

**App can't reach the API:**
- Make sure `EXPO_PUBLIC_API_URL` is your real server URL (not localhost)
- For local testing: use your machine's LAN IP (`ipconfig getifaddr en0`)
