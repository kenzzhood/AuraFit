/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        void: "#0f0e0c",
        stage: "#141310",
        ink: "#1a1814",
        champagne: "#c9a962",
        cream: "#f4eee2",
        dim: "#9a9488",
        muted: "#6b655c",
        border: "#2a2722",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
