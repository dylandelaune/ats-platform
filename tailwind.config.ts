import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{js,tsx}", "./components/**/*{js,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          500: "#3f8dc6e",

        },
      },
    },
  },
  plugins: [],
} as Config;
