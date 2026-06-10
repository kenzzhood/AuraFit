# Aurafit Mobile (Expo) Setup

## Prerequisites

- Node 20+
- Xcode (iOS) or Android Studio (Android)
- Backend running: `npm run dev` at repo root
- Clerk app with mobile redirect URLs configured

## Configure

See **[SETUP_YOUR_KEYS.md](SETUP_YOUR_KEYS.md)** for Clerk and API setup.

1. Copy `apps/mobile/.env.example` → `apps/mobile/.env`
2. Set `EXPO_PUBLIC_API_URL` to your machine LAN IP (not `localhost` on a physical device):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.x:3000
   ```
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from **your** Clerk app (same publishable key as web)

## Install and run

```bash
cd apps/mobile
npm install
npx expo start
```

From repo root:

```bash
npm install
npm run dev          # backend
npm run dev:mobile   # expo
```

## Core screens

| Screen | Route |
|--------|-------|
| Landing | `/` |
| Sign in | `/(auth)/sign-in` |
| Upload | `/(app)/upload` |
| Style | `/(app)/style` |
| Generating | `/(app)/generating` |
| Results | `/(app)/results` |
| Look detail | `/(app)/look/[id]` |
| Refine chat | `/(app)/refine` |

## Privacy note

Photos are saved locally first. A temporary upload to the API occurs when starting generation so the AI can analyze your image.
