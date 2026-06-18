import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#222220",
        cloud: "#f7f4ef",
        mist: "#e9edf0",
        sage: "#9aae9d",
        moss: "#5f7466",
        coral: "#d98b7d",
        lilac: "#a8a0c8",
        skyglass: "#9dc0cf"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(37, 42, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
