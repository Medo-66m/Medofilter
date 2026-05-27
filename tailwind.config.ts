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
        bg: "#050811",
        panel: "#0b1120",
        panel2: "#0f172a",
        text: "#edf2ff",
        muted: "#94a3b8",
        stroke: "rgba(255,255,255,0.08)",
        accent: "#8b5cf6",
        accent2: "#22d3ee",
        success: "#22c55e",
        danger: "#ef4444"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.03), 0 20px 70px rgba(0,0,0,0.42)",
        accent: "0 18px 50px rgba(139,92,246,0.22)",
        soft: "0 10px 30px rgba(0,0,0,0.28)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(139,92,246,0.18), transparent 28%), radial-gradient(circle at right, rgba(34,211,238,0.10), transparent 22%)"
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};

export default config;
