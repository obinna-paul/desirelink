import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      heading: ["var(--font-heading)", "Georgia", "serif"],
      brand: ["var(--font-brand)", "system-ui", "sans-serif"],
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: "hsl(var(--sidebar))",
        neon: {
          pink: "hsl(var(--neon-pink))",
          cyan: "hsl(var(--neon-cyan))",
        },
        presence: {
          offline: "hsl(var(--muted-foreground))",
          online: "hsl(var(--presence-online))",
          live: "hsl(var(--presence-live))",
        },
        account: {
          creator: "hsl(var(--account-creator))",
          explorer: "hsl(var(--account-explorer))",
          seeker: "hsl(var(--account-seeker))",
        },
        "avatar-placeholder": "hsl(var(--avatar-placeholder))",
        trust: "hsl(var(--trust))",
        "accent-soft": "hsl(var(--accent-soft))",
        "accent-tint": {
          DEFAULT: "hsl(var(--accent-tint))",
          border: "hsl(var(--accent-tint-border))",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "1.375rem",
        "2xl": "1.75rem",
      },
      keyframes: {
        "spec-question-enter-forward": {
          "0%": { opacity: "0", transform: "translate3d(2.5rem, 0, 0) scale(0.98)" },
          "70%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "spec-question-enter-backward": {
          "0%": { opacity: "0", transform: "translate3d(-2.5rem, 0, 0) scale(0.98)" },
          "70%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "spec-question-exit-forward": {
          "0%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { opacity: "0", transform: "translate3d(-1.75rem, 0, 0) scale(0.99)" },
        },
        "spec-question-exit-backward": {
          "0%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { opacity: "0", transform: "translate3d(1.75rem, 0, 0) scale(0.99)" },
        },
        "float-heart": {
          "0%": { transform: "translateY(0) scale(0.7)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(-140px) scale(1.15)", opacity: "0" },
        },
        // Sweeps a short bar across an empty track - the honest way to show "working on it"
        // when there's no real percentage yet (see components/ui/upload-progress.tsx).
        "progress-sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        "spec-question-enter-forward":
          "spec-question-enter-forward 520ms cubic-bezier(0.22, 0.65, 0.3, 1) both",
        "spec-question-enter-backward":
          "spec-question-enter-backward 520ms cubic-bezier(0.22, 0.65, 0.3, 1) both",
        "spec-question-exit-forward":
          "spec-question-exit-forward 280ms cubic-bezier(0.4, 0, 0.6, 1) both",
        "spec-question-exit-backward":
          "spec-question-exit-backward 280ms cubic-bezier(0.4, 0, 0.6, 1) both",
        "float-heart": "float-heart 1.6s ease-out forwards",
        "progress-sweep": "progress-sweep 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
