import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    watch: {
      ignored: ["**/backend-dna/**/bin/**", "**/backend-dna/**/obj/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5257",
        changeOrigin: true,
      },
    },
  },
});
