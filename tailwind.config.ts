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
        granite: {
          ink: "#1A1A1A",
          muted: "#6F7477",
          line: "#E8E8E8",
          surface: "#F7F8F8",
          clay: "#B66B45"
        }
      },
      boxShadow: {
        card: "0 12px 30px rgba(26, 26, 26, 0.08)"
      }
    }
  }
};

export default config;
