import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070b14",
        panel: "#0d1322",
        panel2: "#11192c",
        stroke: "rgba(255,255,255,0.09)",
        accent: "#7c3aed",
        accent2: "#22d3ee",
        success: "#22c55e",
        danger: "#ef4444",
        text: "#edf2ff",
        muted: "#9cabcb"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.45)",
        accent: "0 12px 40px rgba(124,58,237,0.24)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(124,58,237,0.22), transparent 25%), radial-gradient(circle at right, rgba(34,211,238,0.12), transparent 20%)"
      }
    }
  },
  plugins: []
};

export default config;
