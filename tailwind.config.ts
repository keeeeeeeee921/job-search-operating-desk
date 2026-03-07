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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        surface: "hsl(var(--surface))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))"
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      boxShadow: {
        soft: "0 18px 38px -28px rgba(31, 29, 35, 0.35)",
        lift: "0 20px 50px -30px rgba(33, 31, 43, 0.4)"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.4rem",
        "3xl": "1.8rem"
      }
    }
  },
  plugins: []
};

export default config;
