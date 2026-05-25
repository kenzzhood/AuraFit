import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          void: "#070608",
          ink: "#0c0c0e",
          surface: "#111114",
          raised: "#16161a",
          highlight: "#1c1c22",
          stage: "#0a0a0c",
          subtle: "rgba(255,255,255,0.06)",
          border: "rgba(255,255,255,0.08)",
          borderBright: "rgba(255,255,255,0.12)",
          muted: "#6b6b73",
          dim: "#9c9ca8",
          foreground: "#f4f3f1",
          champagne: "#d4b896",
          gold: "#b8956b",
          rose: "#b89a93",
          sage: "#7d8f7d",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-dark":
          "radial-gradient(ellipse 80% 60% at 50% -30%, rgba(201,169,98,0.14), transparent), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(196,165,160,0.08), transparent), radial-gradient(ellipse 50% 40% at 0% 20%, rgba(139,159,139,0.06), transparent)",
        "shimmer-gold":
          "linear-gradient(110deg, transparent 0%, rgba(232,196,160,0.12) 45%, rgba(232,196,160,0.22) 50%, rgba(232,196,160,0.12) 55%, transparent 100%)",
      },
      boxShadow: {
        glow: "0 24px 80px -32px rgba(0, 0, 0, 0.75)",
        "glow-sm": "0 12px 40px -24px rgba(0, 0, 0, 0.55)",
        "edge-warm":
          "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(212,184,150,0.12)",
        "inner-highlight": "inset 0 1px 0 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        "spin-slow": "spin 12s linear infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
        beam: "beam 3s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        beam: {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
