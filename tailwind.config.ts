import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#475569",
        background: "#f8fafc",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "sans-serif"],
        cairo: ["var(--font-cairo)"],
        mono: ["var(--font-cairo)"],
        serif: ["var(--font-cairo)"],
      },
    },
  },
  plugins: [],
};
export default config;
