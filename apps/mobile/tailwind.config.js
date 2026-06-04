/** @type {import('tailwindcss').Config} */
// Color tokens mirror the website's `aura.*` palette so the mobile experience
// is visually consistent with web. Class names kept short (e.g. `bg-void`)
// to match existing screen code.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        void: "#070608",
        stage: "#0a0a0c",
        ink: "#0c0c0e",
        surface: "#111114",
        raised: "#16161a",
        highlight: "#1c1c22",
        subtle: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.08)",
        borderBright: "rgba(255,255,255,0.12)",
        muted: "#6b6b73",
        dim: "#9c9ca8",
        cream: "#f4f3f1",
        champagne: "#d4b896",
        gold: "#b8956b",
        rose: "#b89a93",
        sage: "#7d8f7d",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["DM Sans", "System", "sans-serif"],
      },
    },
  },
  plugins: [],
};
