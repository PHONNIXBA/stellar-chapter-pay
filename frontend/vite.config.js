import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
  ],

  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test:
                /node_modules[\\/]react/,
              maxSize: 300000,
              priority: 30,
            },
            {
              name: "stellar-vendor",
              test:
                /node_modules[\\/]@stellar/,
              maxSize: 450000,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules/,
              maxSize: 400000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});